import { URL } from "url";
import { deflateRawSync, inflateRawSync } from "zlib";

import { NesMessage } from "./interfaces";

const mapTypeIntToString = {
    0: "hello",
    1: "ping",
    2: "get",
    3: "post",
    4: "sub",
    5: "unsub",
    6: "pub",
    7: "revoke",
    9: "error",
};

const mapTypeStringToInt = {
    hello: 0,
    ping: 1,
    get: 2,
    post: 3,
    sub: 4,
    unsub: 5,
    pub: 6,
    revoke: 7,
    error: 9,
};

const HEADER_BYTE_LENGTH = 14;

const OFFSETS = {
    FORMAT: 0,
    TYPE: 1,
    ID: 2,
    STATUS_CODE: 6,
    PATH_LENGTH: 8,
    SOCKET_LENGTH: 9,
    HEARTBEAT_INTERVAL: 10,
    HEARTBEAT_TIMEOUT: 12,
};

const MAX_PATH_LENGTH = 255;
const MAX_SOCKET_LENGTH = 100;

const UNIDIRECTIONAL_COMPRESSION = "0";
const BIDIRECTIONAL_COMPRESSION = "1";
const NO_COMPRESSION = "2";

const compress = (buffer: Buffer): Buffer => {
    if (buffer.byteLength > 100) {
        const compressed = deflateRawSync(buffer, { level: 9 });
        if (compressed.byteLength < buffer.byteLength) {
            return compressed;
        }
    }

    return buffer;
};

const decompress = (buffer: Buffer): Buffer => {
    if (buffer.byteLength > 0) {
        try {
            return inflateRawSync(buffer);
        } catch {
            //
        }
    }

    return buffer;
};

export const parseNesMessage = (buf: Buffer, wsapi?: boolean): NesMessage => {
    const messageLength = buf.byteLength;
    if (messageLength < HEADER_BYTE_LENGTH) {
        throw new Error("Nes message is below minimum length");
    }

    const format = buf.readUInt8(OFFSETS.FORMAT).toString();

    const originalType = mapTypeIntToString[buf.readUInt8(OFFSETS.TYPE)];
    let type = originalType;

    if (!type || (!wsapi && !["hello", "error", "ping", "post"].includes(type))) {
        throw new Error("Type is invalid");
    }

    let method = "post";

    if (type === "get" || type === "post") {
        method = type;
        type = "request";
    }

    const id = buf.readUInt32BE(OFFSETS.ID);

    const statusCode = buf.readUInt16BE(OFFSETS.STATUS_CODE);

    const pathLength = buf.readUInt8(OFFSETS.PATH_LENGTH);

    if (pathLength > MAX_PATH_LENGTH || buf.byteLength < HEADER_BYTE_LENGTH + pathLength) {
        throw new Error("Invalid path length");
    }

    let pathBuffer = buf.slice(HEADER_BYTE_LENGTH, HEADER_BYTE_LENGTH + pathLength);

    const socketLength = buf.readUInt8(OFFSETS.SOCKET_LENGTH);

    if (socketLength > MAX_SOCKET_LENGTH || buf.byteLength < HEADER_BYTE_LENGTH + pathLength + socketLength) {
        throw new Error("Invalid socket length");
    }

    let socketBuffer = buf.slice(HEADER_BYTE_LENGTH + pathLength, HEADER_BYTE_LENGTH + pathLength + socketLength);

    const heartbeat = {
        interval: buf.readUInt16BE(OFFSETS.HEARTBEAT_INTERVAL),
        timeout: buf.readUInt16BE(OFFSETS.HEARTBEAT_TIMEOUT),
    };

    let payload = buf.slice(HEADER_BYTE_LENGTH + pathLength + socketLength);

    if (format === BIDIRECTIONAL_COMPRESSION) {
        pathBuffer = decompress(pathBuffer);
        socketBuffer = decompress(socketBuffer);
        payload = decompress(payload);
    }

    let path = pathBuffer.toString();
    if (path && !path.startsWith("/")) {
        const url = new URL(`http://127.0.0.1/${path}`);
        path = url.pathname + url.search;
    }

    const socket = socketBuffer.toString();

    if (originalType !== "post" && pathLength === 255) {
        path += payload.toString();
        payload = Buffer.alloc(0);
    }

    return {
        format,
        type,
        id,
        method,
        statusCode,
        path,
        payload,
        socket,
        heartbeat,
    };
};

export const stringifyNesMessage = (messageObj: NesMessage, format: string): Buffer => {
    if (messageObj.path) {
        if (!messageObj.method || (messageObj.method && messageObj.method.toLowerCase() !== "post")) {
            if (messageObj.path.length > 255) {
                messageObj.payload = messageObj.path.slice(255);
                messageObj.path = messageObj.path.slice(0, 255);
            }
        }
    }

    let pathBuf = Buffer.from(messageObj.path || "");
    let socketBuf = Buffer.from(messageObj.socket || "");
    let payloadBuf = Buffer.from(messageObj.payload || "");
    if (format !== NO_COMPRESSION) {
        if (!messageObj.compressed) {
            messageObj.compressed = {
                path: compress(pathBuf),
                payload: compress(payloadBuf),
                socket: compress(socketBuf),
            };
        }

        if (
            pathBuf.equals(messageObj.compressed.path) &&
            socketBuf.equals(messageObj.compressed.socket) &&
            payloadBuf.equals(messageObj.compressed.payload)
        ) {
            format = UNIDIRECTIONAL_COMPRESSION;
        } else {
            pathBuf = messageObj.compressed.path;
            socketBuf = messageObj.compressed.socket;
            payloadBuf = messageObj.compressed.payload;
            format = BIDIRECTIONAL_COMPRESSION;
        }
    }

    const bufHeader = Buffer.alloc(HEADER_BYTE_LENGTH);

    if (messageObj.type === "request") {
        if (messageObj.method) {
            messageObj.type = messageObj.method.toLowerCase();
        } else {
            messageObj.type = "post";
        }
    }

    bufHeader.writeUInt8(Number.parseInt(format), OFFSETS.FORMAT);
    bufHeader.writeUInt8(
        mapTypeStringToInt[messageObj.type ?? "undefined"] ?? mapTypeStringToInt["undefined"],
        OFFSETS.TYPE,
    );
    bufHeader.writeUInt32BE(messageObj.id || 1, OFFSETS.ID);
    bufHeader.writeUInt16BE(messageObj.statusCode || 200, OFFSETS.STATUS_CODE);
    bufHeader.writeUInt8(pathBuf.byteLength, OFFSETS.PATH_LENGTH);
    bufHeader.writeUInt8(socketBuf.byteLength, OFFSETS.SOCKET_LENGTH);
    bufHeader.writeUInt16BE(messageObj.heartbeat?.interval || 0, OFFSETS.HEARTBEAT_INTERVAL);
    bufHeader.writeUInt16BE(messageObj.heartbeat?.timeout || 0, OFFSETS.HEARTBEAT_TIMEOUT);

    return Buffer.concat([bufHeader, pathBuf, socketBuf, payloadBuf]);
};

export const protocol = {
    gracefulErrorStatusCode: 499,
};
