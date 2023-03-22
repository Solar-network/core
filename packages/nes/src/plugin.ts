/* tslint:disable */
"use strict";

import { Server } from "@hapi/hapi";
import Hoek from "@hapi/hoek";
import Joi from "joi";

import { Listener } from "./listener";

const internals: any = {
    defaults: {
        headers: null,
        payload: {
            maxChunkChars: false,
        },
        heartbeat: {
            interval: 15000, // 15 seconds
            timeout: 5000, // 5 seconds
        },
        maxConnections: false,
    },
};

internals.schema = Joi.object({
    banHammerPlugin: Joi.object(),
    banSeconds: Joi.number().integer().min(0).default(0),
    basePath: Joi.string(),
    disableGet: Joi.boolean(),
    disablePost: Joi.boolean(),
    enabled: Joi.boolean().default(true),
    headers: Joi.array().items(Joi.string().lowercase()).min(1).allow("*", null),
    heartbeat: Joi.object({
        interval: Joi.number().integer().min(1).required(),
        timeout: Joi.number().integer().min(1).less(Joi.ref("interval")).required(),
    }).allow(false),
    maxConnections: Joi.number().integer().min(1).allow(false),
    maxPayload: Joi.number().integer().min(1),
    onConnection: Joi.function(), // async function (socket) {}
    onDisconnection: Joi.function(), // function (socket) {}
    onMessage: Joi.function(), // async function (socket, message) { return data; }    // Or throw errors
    origin: Joi.array().items(Joi.string()).single().min(1),
    path: Joi.string(),
    payload: {
        maxChunkChars: Joi.number().integer().min(1).allow(false),
    },
    rateLimiter: Joi.object(),
    sendErrors: Joi.boolean(),
    socketRateLimit: Joi.number(),
    trustProxy: Joi.boolean(),
    whitelist: Joi.array(),
    wsapi: Joi.boolean(),
});

const plugin = {
    pkg: require("../package.json"),
    requirements: {
        hapi: ">=19.0.0",
    },
    register: function (server: Server, options: any): void {
        if (!options.enabled) {
            return;
        }

        const settings: any = Hoek.applyToDefaults(internals.defaults, options);
        settings.rateLimiter = options.rateLimiter;
        settings.socketRateLimit = options.socketRateLimit;

        if (Array.isArray(settings.headers)) {
            settings.headers = settings.headers.map((field) => field.toLowerCase());
        }

        Joi.assert(settings, internals.schema, "Invalid nes configuration");

        // Create a listener per connection

        const listener = new Listener(server, settings);

        server.ext("onPreStart", () => {
            // Start heartbeats

            listener._beat();

            // Clear stopped state if restarted

            listener._stopped = false;
        });

        // Stop connections when server stops

        server.ext("onPreStop", () => listener._close());

        // Decorate server and request

        server.decorate("request", "socket", internals.socket, { apply: true });
        server.decorate("server", "broadcast", (payload) => listener.broadcast(payload));
        server.decorate("server", "eachSocket", (each, options) => listener.eachSocket(each, options));
        server.decorate("server", "publish", (path, update, options) => listener.publish(path, update, options));
        server.decorate("server", "subscription", (path, options) => listener.subscription(path, options));
    },
};

export { plugin };

internals.socket = function (request) {
    return request.plugins.nes ? request.plugins.nes.socket : null;
};
