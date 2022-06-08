import { ByteBuffer } from "./byte-buffer";

export class ByteBufferArray {
    private readonly buffers: ByteBuffer[] = [];
    private position = 0;

    public getByteBuffer(): ByteBuffer {
        let buffer: ByteBuffer;
        if (this.buffers.length > this.position) {
            buffer = this.buffers[this.position];
        } else {
            buffer = new ByteBuffer(Buffer.alloc(1 * 1024 * 1024));
            this.buffers.push(buffer);
        }

        this.position++;
        buffer.reset();
        return buffer;
    }

    public reset(): void {
        if (this.buffers.length > 10) {
            this.buffers.splice(10);
        }
        this.position = 0;
    }
}
