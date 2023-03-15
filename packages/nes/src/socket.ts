"use strict";

import { serialise } from "@alessiodf/bson";
import Boom from "@hapi/boom";
import Bounce from "@hapi/bounce";
import Hoek from "@hapi/hoek";
import Teamwork from "@hapi/teamwork";

import { parseNesMessage, protocol, stringifyNesMessage } from "./utils";

const internals = {
    version: "2",
};

export class Socket {
    public server;
    public id;
    public app;
    public info;

    public auth = {
        isAuthenticated: false,
        credentials: null,
        artifacts: null,
    };

    public _removed;
    public _pinged;

    public _subscriptions;

    private _ws;
    private _listener;
    private _helloed;
    private _processingCount;
    private _packets;
    private _req;
    private _sending;
    private _lastPinged;
    private _requests;

    public constructor(
        ws: object,
        req: { headers: string[]; socket: { remoteAddress: string; remotePort: number } },
        listener: object,
        ip: string,
    ) {
        this._ws = ws;
        this._listener = listener;
        this._helloed = false;
        this._pinged = true;
        this._processingCount = 0;
        this._packets = [];
        this._sending = false;
        this._subscriptions = {};
        this._removed = new Teamwork.Team();

        this.server = this._listener._server;
        this.id = this._listener._generateId();
        this.app = {};

        this._req = req;
        this._requests = [];

        this.info = {
            remoteAddress: ip,
            remotePort: req.socket.remotePort,
        };

        this._ws.on("error", (error) => {
            if (error instanceof RangeError) {
                this.terminate(error.message.replaceAll("WebSocket", "websocket").replaceAll(":", " -"));
            }
        });
        this._ws.on("message", (message) => this._onMessage(message));
        this._ws.on("ping", () => this.terminate("Malicious ping frame received"));
        this._ws.on("pong", () => this.terminate("Malicious pong frame received"));
    }

    public getWebSocket() {
        if (this._ws && this._ws._socket) {
            return this._ws._socket;
        }
    }

    public disconnect() {
        this._ws.close();
        return this._removed;
    }

    public async publish(path, update) {
        const payload = {
            type: "pub",
            path,
            payload: update,
        };

        return await this._send(payload);
    }

    public async send(payload) {
        const response = {
            type: "update",
            payload,
        };

        return await this._send(response);
    }

    public async revoke(path, update, options = {}) {
        await this._unsubscribe(path);

        const message = {
            type: "revoke",
            path,
            payload: update !== null ? update : undefined,
        };

        return await this._send(message);
    }

    public isOpen(): boolean {
        return this._ws.readyState === 1;
    }

    // public even though it starts with _ ; this is to match the original code
    public _active(): boolean {
        return this._pinged || this._sending || this._processingCount;
    }

    // public because used in listener ; from original code
    public async _send(
        message: { id?: number; payload?: any; type: string },
        options?: { replace?: string },
    ): Promise<unknown> {
        options = options || {};

        if (!this.isOpen()) {
            // Open
            return Promise.reject(Boom.internal("Socket not open"));
        }
        if (
            this._listener._settings.extendedTypes &&
            typeof message.payload === "object" &&
            !(message.payload instanceof Buffer)
        ) {
            message.payload = await serialise(message.payload);
        }

        let string;

        try {
            string = stringifyNesMessage(message);
            if (options.replace) {
                Object.keys(options.replace).forEach((token) => {
                    string = string.replace(`"${token}"`, options!.replace![token]);
                });
            }
        } catch (err) {
            this.server.log(["nes", "serialisation", "error"], message.type);

            if (message.id) {
                return await this._error(Boom.internal("Failed serialising message"), message);
            }

            return Promise.reject(err);
        }

        const team = new Teamwork.Team();
        this._packets.push({ message: string, type: message.type, team });
        this._flush();
        return team.work;
    }

    // private even though it does not start with _ ; adapted from the original code
    private caseInsensitiveKey(object, key) {
        const keys = Object.keys(object);
        for (let i = 0; i < keys.length; ++i) {
            const current = keys[i];
            if (key === current.toLowerCase()) {
                return object[current];
            }
        }

        return undefined;
    }

    private async _flush() {
        if (this._sending || !this._packets.length) {
            return;
        }

        this._sending = true;

        const packet = this._packets.shift();
        let messages = [packet.message];

        // Break message into smaller chunks

        const maxChunkChars = this._listener._settings.payload.maxChunkChars;
        if (maxChunkChars && packet.message.length > maxChunkChars) {
            messages = [];
            const parts = Math.ceil(packet.message.length / maxChunkChars);
            for (let i = 0; i < parts; ++i) {
                const last = i === parts - 1;
                const prefix = last ? "!" : "+";
                messages.push(prefix + packet.message.slice(i * maxChunkChars, (i + 1) * maxChunkChars));
            }
        }

        let error;
        for (let i = 0; i < messages.length; ++i) {
            const message = messages[i];

            const team = new Teamwork.Team();
            this._ws.send(message, (err) => team.attend(err));
            try {
                await team.work;
            } catch (err) {
                error = err;
                break;
            }

            if (packet.type !== "ping") {
                this._pinged = true; // Consider the connection valid if send() was successful
            }
        }

        this._sending = false;
        packet.team.attend(error);

        setImmediate(() => this._flush());
    }

    private _terminate(reason?: string): void {
        if (reason && this._ws && this._ws._socket) {
            this._ws._socket.ban = reason;
        }
        this._ws.terminate();
        return this._removed;
    }

    private async terminate(message) {
        const { banSeconds } = this._listener._settings;

        if (banSeconds > 0) {
            this._listener._bans.set(this.info.remoteAddress, Date.now() + banSeconds * 1000);
        }

        if (this._listener._settings.sendErrors) {
            if (message.statusCode === 403) {
                this._terminate();
            } else {
                if (typeof message === "string") {
                    message = Hoek.clone(Boom.boomify(new Error(message)).output);
                }
                if (message.payload && message.payload.message) {
                    message.payload.message = `${message.statusCode} ${message.payload.message}`;
                    if (banSeconds > 0) {
                        message.payload.message += `\nConnection will be blocked for ${banSeconds} second${
                            banSeconds !== 1 ? "s" : ""
                        }`;
                    }
                }

                message.payload = Buffer.from(JSON.stringify(message.payload));

                await this._send(message);

                if (banSeconds > 0) {
                    this.disconnect();
                    setTimeout(() => {
                        this._terminate();
                    }, 100);
                }
            }
        } else {
            this._terminate(message);
        }

        return this._removed;
    }

    private async _error(err, request?) {
        if (
            err.output?.statusCode === protocol.gracefulErrorStatusCode ||
            (err.output?.statusCode && this._listener._settings.sendErrors)
        ) {
            err = Boom.boomify(err);
            const message = Hoek.clone(err.output);
            delete message.payload.statusCode;
            if (err.output?.statusCode !== protocol.gracefulErrorStatusCode) {
                if (
                    message.payload.message &&
                    message.payload.message.startsWith("{") &&
                    message.payload.message.endsWith("}")
                ) {
                    const parsed = JSON.parse(message.payload.message);
                    if (parsed.message) {
                        if (parsed.error !== parsed.message) {
                            message.payload.message = `${parsed.error} (${parsed.message})`;
                        } else {
                            message.payload.message = parsed.error;
                        }
                    }
                }
            }

            message.headers = this._filterHeaders(message.headers);

            if (request) {
                message.type = request.type;
                message.id = request.id;
            }

            if (err.output?.statusCode === protocol.gracefulErrorStatusCode) {
                message.payload = Buffer.from(JSON.stringify(message.payload));
                return await this._send(message);
            } else {
                return this.terminate(message);
            }
        } else {
            return this.terminate(err.output.payload.message);
        }
    }

    private async _onMessage(message) {
        if (
            this._listener._bans.has(this.info.remoteAddress) &&
            this._listener._bans.get(this.info.remoteAddress) > Date.now()
        ) {
            return this._terminate();
        }

        let request;
        try {
            if (!(message instanceof Buffer)) {
                return this.terminate("Invalid message received");
            }
            request = parseNesMessage(message, this._listener._settings.extendedTypes);
        } catch (err) {
            return this.terminate("Invalid payload received");
        }

        this._pinged = true;
        ++this._processingCount;

        let response, options, error;
        try {
            const lifecycleResponse = await this._lifecycle(request);
            response = lifecycleResponse.response;
            options = lifecycleResponse.options;
        } catch (err) {
            Bounce.rethrow(err, "system");
            error = err;
        }

        try {
            if (error) {
                await this._error(error, request);
            } else if (response) {
                await this._send(response, options);
            }
        } catch (err) {
            Bounce.rethrow(err, "system");
            this._terminate();
        }

        --this._processingCount;
    }

    private async _lifecycle(request): Promise<any> {
        if (!request.type) {
            throw Boom.badRequest("Cannot parse message");
        }

        if (!request.id) {
            throw Boom.badRequest("Message missing id");
        }

        // Initialisation and Authentication

        if (request.type === "ping") {
            if (this._lastPinged && Date.now() < this._lastPinged + 1000) {
                throw Boom.badRequest("Exceeded ping limit");
            }
            this._lastPinged = Date.now();
            return {};
        }

        if (request.type === "hello") {
            return this._processHello(request);
        }

        if (!this._helloed) {
            throw Boom.badRequest("Connection is not initialised");
        }

        this._requests.push(Date.now());
        this._requests = this._requests.filter((request) => Date.now() < request + 1000);

        // Endpoint request

        if (request.type === "request") {
            if (!request.method) {
                request.method = "post";
            } else if (
                (request.method === "get" && this._listener._settings.disableGet) ||
                (request.method === "post" && this._listener._settings.disablePost)
            ) {
                throw Boom.methodNotAllowed();
            }
            return this._processRequest(request);
        }

        if (this._requests.length > this._listener._settings.socketRateLimit) {
            throw Boom.badRequest("Exceeded socket rate limit");
        }

        // Subscriptions

        if (request.type === "sub") {
            return this._processSubscription(request);
        }

        if (request.type === "unsub") {
            return this._processUnsub(request);
        }

        // Unknown

        throw Boom.badRequest("Unknown message type");
    }

    private async _processHello(request) {
        if (this._helloed) {
            throw Boom.badRequest("Connection already initialised");
        }

        if (request.version !== internals.version) {
            throw Boom.badRequest(
                "Incorrect protocol version (expected " +
                    internals.version +
                    " but received " +
                    (request.version || "none") +
                    ")",
            );
        }

        this._helloed = true; // Prevents the client from reusing the socket if erred (leaves socket open to ensure client gets the error response)

        if (this._listener._settings.onConnection) {
            await this._listener._settings.onConnection(this);
        }

        if (request.payload && request.payload.length > 0) {
            try {
                if (request.payload.length > 102400) {
                    throw new Error();
                }

                const subs = JSON.parse(request.payload);

                if (!Array.isArray(subs) || subs.length > 1000) {
                    throw new Error();
                }

                for (const sub of subs) {
                    if (typeof sub !== "string") {
                        throw new Error();
                    }
                    await this._listener._subscribe(sub, this);
                }
            } catch {
                throw Boom.badRequest("Invalid subscription payload");
            }
        }

        const response = {
            type: "hello",
            id: request.id,
            heartbeat: this._listener._settings.heartbeat,
            socket: this.id,
        };

        return { response };
    }

    private async _processRequest(request) {
        let method = request.method;
        if (!method) {
            throw Boom.badRequest("Message missing method");
        }

        let path = request.path;
        if (!path) {
            throw Boom.badRequest("Message missing path");
        }

        if (request.headers && this.caseInsensitiveKey(request.headers, "authorization")) {
            throw Boom.badRequest("Cannot include an Authorization header");
        }

        path = this._listener._settings.basePath ? this._listener._settings.basePath + path : path.slice(1);

        if (path[0] !== "/") {
            // Route id
            const route = this.server.lookup(path);
            if (!route) {
                throw Boom.notFound();
            }

            path = route.path;
            method = route.method;

            if (method === "*") {
                throw Boom.badRequest("Cannot use route id with wildcard method route config");
            }
        }

        const headers = { "content-type": "application/octet-stream", origin: this._req.headers.origin };
        let payload = request.payload;

        if (this._listener._settings.extendedTypes) {
            headers["content-type"] = "application/json";
            if (method === "post") {
                if (payload) {
                    try {
                        payload = JSON.parse(payload);
                    } catch {
                        throw Boom.badRequest("Invalid or missing payload");
                    }
                }
            } else {
                payload = undefined;
            }
        }

        const shot = {
            method,
            url: path,
            payload,
            headers,
            auth: null,
            validate: false,
            plugins: {
                nes: {
                    socket: this,
                },
            },
            remoteAddress: this.info.remoteAddress,
            allowInternals: true,
        };

        const res = await this.server.inject(shot);
        if (res.statusCode >= 400) {
            throw Boom.boomify(new Error(typeof res.result === "object" ? JSON.stringify(res.result) : res.result), {
                statusCode: res.statusCode,
            });
        }

        const response = {
            type: "request",
            method,
            id: request.id,
            statusCode: res.statusCode,
            payload: res.result,
            headers: this._filterHeaders(res.headers),
        };

        return { response, options: {} };
    }

    private _pathToPaths(path) {
        return path
            .split("/")
            .slice(1)
            .map((element) => (element.includes(",") ? element.split(",") : element))
            .reduce(
                (prev, curr) =>
                    Array.isArray(curr)
                        ? prev.flatMap((a) => curr.map((b) => a + "/" + b))
                        : prev.map((a) => a + "/" + curr),
                [""],
            );
    }
    private async _processSubscription(request) {
        const paths = this._pathToPaths(request.path);

        for (const path of paths) {
            await this._listener._subscribe(path, this);
        }

        const response = {
            type: "sub",
            id: request.id,
            path: request.path,
        };

        return { response };
    }

    private async _processUnsub(request) {
        const paths = this._pathToPaths(request.path);

        for (const path of paths) {
            await this._unsubscribe(path);
        }

        const response = {
            type: "unsub",
            id: request.id,
        };

        return { response };
    }

    private _unsubscribe(path) {
        const sub = this._subscriptions[path];
        if (sub) {
            delete this._subscriptions[path];
            return sub.remove(this, path);
        }
    }

    private _filterHeaders(headers) {
        const filter = this._listener._settings.headers;
        if (!filter) {
            return undefined;
        }

        if (filter === "*") {
            return headers;
        }

        const filtered = {};
        const fields = Object.keys(headers);
        for (let i = 0; i < fields.length; ++i) {
            const field = fields[i];
            if (filter.indexOf(field.toLowerCase()) !== -1) {
                filtered[field] = headers[field];
            }
        }

        return filtered;
    }
}
