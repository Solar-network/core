import { ClientRequest, IncomingMessage, request as httpRequest } from "http";
import { request as httpsRequest, RequestOptions } from "https";
import { stringify } from "querystring";
import { Primitive } from "type-fest";
import { parse } from "url";

import { isObject } from "./is-object";
import { isUndefined } from "./is-undefined";

export type HttpOptions = RequestOptions & {
    body?: Record<string, Primitive>;
    json?: boolean;
    rejectOnError?: boolean;
};

export type HttpResponse = {
    method: string | undefined;
    statusCode: number | undefined;
    statusMessage: string | undefined;
    data: any;
    headers: string[];
};

export class HttpError extends Error {
    public constructor(response: HttpResponse, error?: Error) {
        const message: string | undefined = error ? error.message : response.statusMessage;

        super(message);

        Object.defineProperty(this, "message", {
            enumerable: false,
            value: message,
        });

        Object.defineProperty(this, "name", {
            enumerable: false,
            value: this.constructor.name,
        });

        Object.defineProperty(this, "response", {
            enumerable: false,
            value: {
                statusMessage: response.statusMessage,
                statusCode: response.statusCode,
                headers: response.headers,
                data: response.data,
            },
        });

        Error.captureStackTrace(this, this.constructor);
    }
}

const sendRequest = (method: string, url: string, opts?: HttpOptions): Promise<HttpResponse> =>
    new Promise((res, rej) => {
        if (!isObject(opts)) {
            opts = {};
        }

        opts = { ...opts, ...parse(url) };
        opts.method = method.toLowerCase();

        let request = httpRequest;

        if (opts.protocol === "https:") {
            request = httpsRequest;
        }

        if (isUndefined(opts.timeout)) {
            opts.timeout = 1500;
        }

        if (isUndefined(opts.rejectOnError)) {
            opts.rejectOnError = true;
        }

        const req: ClientRequest = request(opts, (r: IncomingMessage): void => {
            let accumulator: string = "";

            r.setEncoding("utf8");

            r.on("data", (chunk: string) => (accumulator += chunk));

            r.on("end", (): void => {
                const response: HttpResponse = {
                    method,
                    statusCode: r.statusCode,
                    statusMessage: r.statusMessage,
                    data: "",
                    headers: r.rawHeaders,
                };

                const type: string | undefined = r.headers["content-type"];

                if (type && accumulator && type.includes("application/json")) {
                    try {
                        accumulator = JSON.parse(accumulator);
                    } catch (error) {
                        return rej(new HttpError(response, error));
                    }
                }

                response.statusCode = r.statusCode;
                response.statusMessage = r.statusMessage;
                response.data = accumulator;

                if (opts!.rejectOnError && r.statusCode && r.statusCode >= 400) {
                    return rej(new HttpError(response));
                }

                return res(response);
            });
        });

        req.on("error", rej);

        req.on("timeout", () => req.abort());

        if (opts.body) {
            let body: string;

            if (opts.json === false) {
                body = stringify(opts.body as Record<string, any>);
                req.setHeader("content-type", "application/x-www-form-urlencoded");
            } else {
                body = JSON.stringify(opts.body);
                req.setHeader("content-type", "application/json");
            }
            req.setHeader("content-length", Buffer.byteLength(body));
            req.write(body);
        }

        req.end();
    });

export const http = {
    get: (url: string, opts?: HttpOptions): Promise<HttpResponse> => sendRequest("GET", url, opts),
    head: (url: string, opts?: HttpOptions): Promise<HttpResponse> => sendRequest("HEAD", url, opts),
    post: (url: string, opts?: HttpOptions): Promise<HttpResponse> => sendRequest("POST", url, opts),
    put: (url: string, opts?: HttpOptions): Promise<HttpResponse> => sendRequest("PUT", url, opts),
    patch: (url: string, opts?: HttpOptions): Promise<HttpResponse> => sendRequest("PATCH", url, opts),
    delete: (url: string, opts?: HttpOptions): Promise<HttpResponse> => sendRequest("DELETE", url, opts),
};
