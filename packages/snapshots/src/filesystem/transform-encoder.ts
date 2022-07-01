import { Utils } from "@solar-network/crypto";
import { Transform, TransformCallback } from "stream";

export class TransformEncoder extends Transform {
    public constructor(private encode: Function) {
        super({ objectMode: true });
    }

    public _transform(chunk: object, encoding: string, callback: TransformCallback): void {
        const encoded: Buffer = this.encode(chunk);

        const buffer: Utils.ByteBuffer = new Utils.ByteBuffer(Buffer.alloc(4 + encoded.length));

        buffer.writeUInt32LE(encoded.length);
        buffer.writeBuffer(encoded);

        this.push(buffer.getResult());

        callback();
    }
}
