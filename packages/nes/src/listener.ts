"use strict";

import { serialise } from "@alessiodf/bson";
import Boom from "@hapi/boom";
import Call from "@hapi/call";
import { Server } from "@hapi/hapi";
import Hoek from "@hapi/hoek";
import Validate from "@hapi/validate";
import { Utils } from "@solar-network/kernel";
import Ws from "ws";

import { Socket } from "./socket";

const internals = {
    counter: {
        min: 10000,
        max: 99999,
    },
    subSchema: Validate.object({
        filter: Validate.func(), // async function (path, update, options), where options: { credentials, params }, returns true, false, { override }, or throws an error
        onSubscribe: Validate.func(), // async function (socket, path, params)
        onUnsubscribe: Validate.func() // async function (socket, path, params)
            .allow(false),
    }),
};

export class Listener {
    public _stopped;

    private _server;
    private _settings;
    private _sockets;
    private _socketCounter;
    private _heartbeat;
    private _beatTimeout;
    private _router;
    private _wss;

    private _bans;

    public constructor(server: Server, settings: { maxPayload: number; origin: string; path: string }) {
        this._server = server;
        this._settings = settings;
        this._sockets = new Sockets(this);
        this._socketCounter = internals.counter.min;
        this._heartbeat = null;
        this._beatTimeout = null;
        this._router = new Call.Router();
        this._stopped = false;
        this._bans = new Map();

        // WebSocket listener
        // server: this._server.listener
        const options: any = {
            noServer: true,
            maxPayload: settings.maxPayload,
            perMessageDeflate: false,
        };
        if (settings.origin) {
            options.verifyClient = (info) => settings.origin.indexOf(info.origin) >= 0;
        }

        this._wss = new Ws.Server(options);

        this._server.listener.on("upgrade", (request, socket, headers) => {
            if (request.url === settings.path) {
                this._wss.handleUpgrade(request, socket, headers, (ws) => {
                    this._wss.emit("connection", ws, request);
                });
            } else {
                socket.destroy();
            }
        });

        this._wss.on("connection", async (ws, req) => {
            ws._socket.wsOpen = true;

            ws.on("error", Hoek.ignore);

            for (const [key, value] of this._bans) {
                if (Date.now() >= value) {
                    this._bans.delete(key);
                }
            }

            let ip = req.socket.remoteAddress;

            if (this._settings.trustProxy) {
                ip = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ?? req.socket.remoteAddress;
            }

            if (this._bans.has(ip)) {
                ws.terminate();
                return;
            }

            if (this._settings.whitelist) {
                if (!Utils.isWhitelisted(this._settings.whitelist, ip)) {
                    ws.terminate();
                    return;
                }
            }

            if (this._settings.rateLimiter) {
                const rateLimiter = await this._settings.rateLimiter.get(ip);
                if (rateLimiter && rateLimiter.remainingPoints <= 0) {
                    ws.terminate();
                    return;
                }
            }

            if (
                this._stopped ||
                (this._settings.maxConnections && this._sockets.length() >= this._settings.maxConnections)
            ) {
                return ws.terminate();
            }

            this._add(ws, req, ip);
        });

        this._wss.on("error", Hoek.ignore);

        // Register with the server

        this._server.plugins.nes = { _listener: this };
    }

    public async _close(): Promise<void> {
        this._stopped = true;
        clearTimeout(this._heartbeat);
        clearTimeout(this._beatTimeout);

        await Promise.all(Object.keys(this._sockets._items).map((id) => this._sockets._items[id].disconnect()));

        this._wss.close();
    }

    public broadcast(payload) {
        const update = {
            type: "update",
            payload,
        };

        return this._broadcast(update);
    }

    public _beat(): void {
        if (!this._settings.heartbeat) {
            return;
        }

        if (
            this._heartbeat && // Skip the first time
            this._sockets.length()
        ) {
            // Send heartbeats

            const update = {
                type: "ping",
            };

            this._sockets._forEach((socket: Socket) => socket._send(update).catch(Hoek.ignore)); // Ignore errors

            // Verify client responded

            this._beatTimeout = setTimeout(() => {
                this._sockets._forEach((socket: Socket) => {
                    if (!socket._active()) {
                        socket.disconnect();
                        return;
                    }

                    socket._pinged = false;
                });
            }, this._settings.heartbeat.timeout);
        }

        // Schedule next heartbeat

        this._heartbeat = setTimeout(() => {
            this._beat();
        }, this._settings.heartbeat.interval);
    }

    public _generateId(): string {
        const id = Date.now() + ":" + this._server.info.id + ":" + this._socketCounter++;
        if (this._socketCounter > internals.counter.max) {
            this._socketCounter = internals.counter.min;
        }

        return id;
    }

    public subscription(path, options) {
        Hoek.assert(path, "Subscription missing path");
        Validate.assert(options, internals.subSchema, "Invalid subscription options: " + path);

        const settings = Hoek.clone(options || {});

        // Path configuration

        const route = {
            method: "sub",
            path,
        };

        const config = {
            subscribers: new Subscribers(this._server, settings),
            filter: settings.filter,
        };

        this._router.add(route, config);
    }

    public async publish(path, update, options) {
        Hoek.assert(path && path[0] === "/", "Missing or invalid subscription path:", path || "empty");

        options = options || {};

        const payload = {
            type: "pub",
            path,
            payload: update,
        };

        return this._publish(path, payload, options);
    }

    public async _subscribe(path, socket) {
        // Errors include subscription context in payloads in case returned as connection errors

        if (path.indexOf("?") !== -1) {
            throw Boom.badRequest("Subscription path cannot contain query");
        }

        if (socket._subscriptions[path]) {
            return;
        }

        if (Object.keys(socket._subscriptions).length === 1000) {
            return;
        }

        const match = this._router.route("sub", path);
        if (match.isBoom) {
            throw Boom.notFound("Subscription Not Found");
        }

        await match.route.subscribers.add(socket, path, match);
        socket._subscriptions[path] = match.route.subscribers;
    }

    public eachSocket(each, options) {
        options = options || {};
        return this._eachSocket(each, options);
    }

    private _publish(path, _update, options) {
        if (this._stopped) {
            return;
        }

        const match = this._router.route("sub", path);
        if (match.isBoom) {
            return;
        }

        const each = async (socket) => {
            if (_update.payload && !(_update.payload instanceof Buffer)) {
                _update.payload = await serialise(_update.payload);
            }

            return socket._send(_update).catch(Hoek.ignore); // Ignore errors
        };

        const route = match.route;
        return route.subscribers._forEachSubscriber(match.paramsArray.length ? path : null, options, each);
    }

    private _eachSocket(each, options) {
        if (this._stopped) {
            return;
        }

        if (!options.subscription) {
            Hoek.assert(!options.user, "Cannot specify user filter without a subscription path");
            return this._sockets._forEach(each);
        }

        const sub = this._router.route("sub", options.subscription);
        if (sub.isBoom) {
            return;
        }

        const route = sub.route;
        return route.subscribers._forEachSubscriber(
            sub.paramsArray.length ? options.subscription : null,
            options,
            each,
        ); // Filter on path if has parameters
    }

    private _add(ws, req, ip): void {
        // Socket object

        const socket = new Socket(ws, req, this, ip);

        this._sockets.add(socket);

        ws.once("close", async () => {
            this._sockets.remove(socket);

            const subs = Object.keys(socket._subscriptions);
            for (let i = 0; i < subs.length; ++i) {
                const sub = subs[i];
                const subscribers = socket._subscriptions[sub];
                await subscribers.remove(socket);
            }

            socket._subscriptions = {};

            if (this._settings.onDisconnection) {
                this._settings.onDisconnection(socket);
            }

            socket._removed.attend();
        });
    }

    private _broadcast(update) {
        if (this._stopped) {
            return;
        }

        const each = (socket) => socket._send(update).catch(Hoek.ignore);

        return this._sockets._forEach(each);
    }
}

// Sockets manager

class Sockets {
    private _items;

    public constructor(listener) {
        this._items = {};
    }

    public add(socket) {
        this._items[socket.id] = socket;
    }

    public remove(socket) {
        delete this._items[socket.id];
    }

    public length() {
        return Object.keys(this._items).length;
    }

    public async _forEach(each) {
        for (const item in this._items) {
            await each(this._items[item]);
        }
    }
}

// Subscribers manager

class Subscribers {
    private _items;
    private _settings;
    private _server;

    public constructor(server, options) {
        this._items = {};
        this._settings = options;
        this._server = server;
    }

    public async add(socket, path, match) {
        if (this._settings.onSubscribe) {
            await this._settings.onSubscribe(socket, path, match.params);
        }

        const item = this._items[socket.id];
        if (item) {
            item.paths.push(path);
            item.params.push(match.params);
        } else {
            this._items[socket.id] = { socket, paths: [path], params: [match.params] };
        }
    }

    public async remove(socket, path) {
        const item = this._items[socket.id];
        if (!item) {
            return;
        }

        if (!path) {
            this._cleanup(socket, item);

            if (this._settings.onUnsubscribe) {
                for (let i = 0; i < item.paths.length; ++i) {
                    const itemPath = item.paths[i];
                    await this._remove(socket, itemPath, item.params[i]);
                }
            }

            return;
        }
        const pos = item.paths.indexOf(path);
        const params = item.params[pos];

        if (item.paths.length === 1) {
            this._cleanup(socket, item);
        } else {
            item.paths.splice(pos, 1);
            item.params.splice(pos, 1);
        }

        if (this._settings.onUnsubscribe) {
            return this._remove(socket, path, params);
        }
    }

    public async _forEachSubscriber(path, options, each) {
        const itemise = async (item) => {
            if (item && (!path || item.paths.indexOf(path) !== -1)) {
                await each(item.socket);
            }
        };

        const items = Object.keys(this._items);
        for (let i = 0; i < items.length; ++i) {
            const item = this._items[items[i]];
            await itemise(item);
        }
    }

    private async _remove(socket, path, params) {
        try {
            await this._settings.onUnsubscribe(socket, path, params);
        } catch (err) {
            this._server.log(["nes", "onUnsubscribe", "error"], err);
        }
    }

    private _cleanup(socket, item) {
        delete this._items[socket.id];
    }
}
