export class ByteBuffer {
    private readonly buf: Buffer;
    private offset = 0;

    public constructor(buf: Buffer) {
        this.buf = buf;
    }

    public getBuffer(): Buffer {
        return this.buf;
    }

    public getOffset(): number {
        return this.offset;
    }

    public getRemainder(): Buffer {
        return this.buf.slice(this.offset);
    }

    public getRemainderLength(): number {
        return this.buf.length - this.offset;
    }

    public getResult(): Buffer {
        return this.buf.slice(0, this.offset);
    }

    public getResultLength(): number {
        return this.offset;
    }

    public reset(): void {
        this.offset = 0;
    }

    public goTo(position: number) {
        if (position < 0 || position > this.buf.length) {
            throw new Error("Jump over buffer boundary: " + position + " vs " + this.buf.length);
        }

        this.offset = position;
    }

    public jump(length: number): void {
        if (length < -this.offset || length > this.getRemainderLength()) {
            throw new Error("Jump over buffer boundary");
        }

        this.offset += length;
    }

    public writeInt8(value: number): void {
        this.offset = this.buf.writeInt8(value, this.offset);
    }

    public writeInt16BE(value: number): void {
        this.offset = this.buf.writeInt16BE(value, this.offset);
    }

    public writeInt16LE(value: number): void {
        this.offset = this.buf.writeInt16LE(value, this.offset);
    }

    public writeInt32BE(value: number): void {
        this.offset = this.buf.writeInt32BE(value, this.offset);
    }

    public writeInt32LE(value: number): void {
        this.offset = this.buf.writeInt32LE(value, this.offset);
    }

    public writeBigInt64BE(value: bigint): void {
        this.offset = this.buf.writeBigInt64BE(value, this.offset);
    }

    public writeBigInt64LE(value: bigint): void {
        this.offset = this.buf.writeBigInt64LE(value, this.offset);
    }

    public writeUInt8(value: number): void {
        this.offset = this.buf.writeUInt8(value, this.offset);
    }

    public writeUInt16BE(value: number): void {
        this.offset = this.buf.writeUInt16BE(value, this.offset);
    }

    public writeUInt16LE(value: number): void {
        this.offset = this.buf.writeUInt16LE(value, this.offset);
    }

    public writeUInt32BE(value: number): void {
        this.offset = this.buf.writeUInt32BE(value, this.offset);
    }

    public writeUInt32LE(value: number): void {
        this.offset = this.buf.writeUInt32LE(value, this.offset);
    }

    public writeBigUInt64BE(value: bigint): void {
        this.offset = this.buf.writeBigUInt64BE(value, this.offset);
    }

    public writeBigUInt64LE(value: bigint): void {
        this.offset = this.buf.writeBigUInt64LE(value, this.offset);
    }

    public writeBuffer(value: Buffer): void {
        if (value.length > this.getRemainderLength()) {
            throw new Error("Write over buffer boundary");
        }

        this.offset += value.copy(this.buf, this.offset);
    }

    public readInt8(): number {
        const value = this.buf.readInt8(this.offset);
        this.offset += 1;
        return value;
    }

    public readInt16BE(): number {
        const value = this.buf.readInt16BE(this.offset);
        this.offset += 2;
        return value;
    }

    public readInt16LE(): number {
        const value = this.buf.readInt16LE(this.offset);
        this.offset += 2;
        return value;
    }

    public readInt32BE(): number {
        const value = this.buf.readInt32BE(this.offset);
        this.offset += 4;
        return value;
    }

    public readInt32LE(): number {
        const value = this.buf.readInt32LE(this.offset);
        this.offset += 4;
        return value;
    }

    public readBigInt64BE(): bigint {
        const value = this.buf.readBigInt64BE(this.offset);
        this.offset += 8;
        return value;
    }

    public readBigInt64LE(): bigint {
        const value = this.buf.readBigInt64LE(this.offset);
        this.offset += 8;
        return value;
    }

    public readUInt8(): number {
        const value = this.buf.readUInt8(this.offset);
        this.offset += 1;
        return value;
    }

    public readUInt16BE(): number {
        const value = this.buf.readUInt16BE(this.offset);
        this.offset += 2;
        return value;
    }

    public readUInt16LE(): number {
        const value = this.buf.readUInt16LE(this.offset);
        this.offset += 2;
        return value;
    }

    public readUInt32BE(): number {
        const value = this.buf.readUInt32BE(this.offset);
        this.offset += 4;
        return value;
    }

    public readUInt32LE(): number {
        const value = this.buf.readUInt32LE(this.offset);
        this.offset += 4;
        return value;
    }

    public readBigUInt64BE(): bigint {
        const value = this.buf.readBigUInt64BE(this.offset);
        this.offset += 8;
        return value;
    }

    public readBigUInt64LE(): bigint {
        const value = this.buf.readBigUInt64LE(this.offset);
        this.offset += 8;
        return value;
    }

    public readBuffer(length: number): Buffer {
        if (length > this.getRemainderLength()) {
            throw new Error("Read over buffer boundary");
        }

        const value = this.buf.slice(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }
}
