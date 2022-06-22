import { Utils } from "@solar-network/crypto";
import fs from "fs-extra";
import { pipeline, Readable } from "stream";
import zlib from "zlib";

import { Stream as StreamContracts } from "../contracts";
import { Stream as StreamExceptions } from "../exceptions";
import { removeListeners } from "./utils";

export class StreamReader {
    public count: number = 0;

    private isEnd = false;
    private readStream?: Readable;
    private stream?: Readable;

    private buffer: Utils.ByteBuffer = new Utils.ByteBuffer(Buffer.alloc(0));
    private offset = 0;
    private length = 0;

    public constructor(private path: string, private useCompression: boolean, private decode: Function) {
        process.on("exit", () => {
            this.destroyStreams();
        });
    }

    public open(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            this.readStream = fs.createReadStream(this.path);

            if (this.useCompression) {
                this.stream = pipeline(this.readStream, zlib.createGunzip(), () => {});
            } else {
                this.stream = this.readStream;
            }

            const eventListenerPairs = [] as StreamContracts.EventListenerPair[];

            const onOpen = () => {
                removeListeners(this.readStream!, eventListenerPairs);
                resolve();
            };

            const onError = (err) => {
                removeListeners(this.readStream!, eventListenerPairs);

                this.destroyStreams();
                reject(err);
            };

            eventListenerPairs.push({ event: "open", listener: onOpen });
            eventListenerPairs.push({ event: "error", listener: onError });

            this.readStream.on("open", onOpen);
            this.readStream.on("error", onError);

            this.stream.on("end", () => {
                this.isEnd = true;
                this.destroyStreams();
            });
        });
    }

    public async readNext(): Promise<any> {
        let lengthChunk: Utils.ByteBuffer;
        try {
            lengthChunk = await this.read(4);
        } catch (err) {
            if (err instanceof StreamExceptions.EndOfFile) {
                this.isEnd = true;
                return null;
            }

            throw err;
        }
        const length = lengthChunk.readUInt32LE();
        const dataChunk = await this.read(length);

        this.count++;
        return this.decode(dataChunk.getBuffer());
    }

    private async readNextChunk(): Promise<void> {
        if (this.isEnd) {
            throw new StreamExceptions.EndOfFile(this.path);
        }

        if (!this.stream) {
            throw new StreamExceptions.StreamNotOpen(this.path);
        }

        await this.waitUntilReadable();

        const chunk: Buffer | null = this.stream.read() as Buffer;

        if (chunk === null) {
            throw new StreamExceptions.EndOfFile(this.path);
        }

        this.buffer = new Utils.ByteBuffer(Buffer.alloc(chunk.length));
        this.buffer.writeBuffer(chunk);
        this.length = chunk.length;
        this.offset = 0;
    }

    private waitUntilReadable(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const eventListenerPairs = [] as StreamContracts.EventListenerPair[];

            const onReadable = () => {
                removeListeners(this.stream!, eventListenerPairs);
                resolve();
            };

            const onError = () => {
                removeListeners(this.stream!, eventListenerPairs);

                this.destroyStreams();
                reject(new Error("Error on stream"));
            };

            const onEnd = () => {
                removeListeners(this.stream!, eventListenerPairs);

                this.destroyStreams();
                reject(new StreamExceptions.EndOfFile(this.path));
            };

            eventListenerPairs.push({ event: "readable", listener: onReadable });
            eventListenerPairs.push({ event: "error", listener: onError });
            eventListenerPairs.push({ event: "end", listener: onEnd });

            this.stream!.once("readable", onReadable);

            this.stream!.once("error", onError);

            this.stream!.once("end", onEnd);
        });
    }

    private async read(size: number): Promise<Utils.ByteBuffer> {
        const bufferToReturn = new Utils.ByteBuffer(Buffer.alloc(size));
        let remaining = size;
        while (remaining > 0) {
            if (this.offset === this.length) {
                await this.readNextChunk();
            }

            let copyLength = 0;
            if (this.offset + remaining <= this.length) {
                copyLength = remaining;
            } else {
                copyLength = this.length - this.offset;
            }

            const offset: number = this.buffer.getOffset();
            this.buffer.goTo(this.offset);
            bufferToReturn.writeBuffer(this.buffer.readBuffer(copyLength));
            this.buffer.goTo(offset);
            this.offset += copyLength;
            remaining -= copyLength;
        }
        bufferToReturn.reset();
        return bufferToReturn;
    }

    private destroyStreams(): void {
        this.readStream?.destroy();
    }
}
