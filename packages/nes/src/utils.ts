import { URL } from "url";

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
    VERSION: 0,
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

export const parseNesMessage = (buf: Buffer, extendedTypes?: boolean): NesMessage => {
    const messageLength = buf.byteLength;
    if (messageLength < HEADER_BYTE_LENGTH) {
        throw new Error("Nes message is below minimum length");
    }

    const version = buf.readUInt8(OFFSETS.VERSION).toString();

    const originalType = mapTypeIntToString[buf.readUInt8(OFFSETS.TYPE)];
    let type = originalType;

    if (!type || (!extendedTypes && !["hello", "error", "ping", "post"].includes(type))) {
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

    let path = buf.slice(HEADER_BYTE_LENGTH, HEADER_BYTE_LENGTH + pathLength).toString();

    if (path) {
        const url = new URL(`http://127.0.0.1/${path}`);
        path = url.pathname + url.search;
    }

    const socketLength = buf.readUInt8(OFFSETS.SOCKET_LENGTH);

    if (socketLength > MAX_SOCKET_LENGTH || buf.byteLength < HEADER_BYTE_LENGTH + pathLength + socketLength) {
        throw new Error("Invalid socket length");
    }
    const socket = buf
        .slice(HEADER_BYTE_LENGTH + pathLength, HEADER_BYTE_LENGTH + pathLength + socketLength)
        .toString();

    const heartbeat = {
        interval: buf.readUInt16BE(OFFSETS.HEARTBEAT_INTERVAL),
        timeout: buf.readUInt16BE(OFFSETS.HEARTBEAT_TIMEOUT),
    };

    let payload = buf.slice(HEADER_BYTE_LENGTH + pathLength + socketLength);

    if (originalType !== "post" && pathLength === 255) {
        path += payload.toString();
        payload = Buffer.alloc(0);
    }

    return {
        version,
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

export const stringifyNesMessage = (messageObj: NesMessage): Buffer => {
    if (messageObj.path) {
        if (!messageObj.method || (messageObj.method && messageObj.method.toLowerCase() !== "post")) {
            if (messageObj.path.length > 255) {
                messageObj.payload = messageObj.path.slice(255);
                messageObj.path = messageObj.path.slice(0, 255);
            }
        }
    }

    const pathBuf = Buffer.from(messageObj.path || "");
    const socketBuf = Buffer.from(messageObj.socket || "");
    const payloadBuf = Buffer.from(messageObj.payload || "");

    const bufHeader = Buffer.alloc(HEADER_BYTE_LENGTH);

    if (messageObj.type === "request") {
        if (messageObj.method) {
            messageObj.type = messageObj.method.toLowerCase();
        } else {
            messageObj.type = "post";
        }
    }

    bufHeader.writeUInt8(Number.parseInt(messageObj.version || "0"), OFFSETS.VERSION);
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
