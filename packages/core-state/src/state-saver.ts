import { Application, Container, Contracts, Providers } from "@solar-network/core-kernel";
import { Interfaces, Utils } from "@solar-network/crypto";
import { closeSync, existsSync, openSync, readdirSync, renameSync, statSync, unlinkSync, writeSync } from "fs";

import { SavedStateValueType } from "./enums";

@Container.injectable()
export class StateSaver {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Application;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/core-state")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.StateMachine)
    private readonly stateMachine;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    private byteBufferArray = new Utils.ByteBufferArray();

    public async run(): Promise<void> {
        try {
            const block: Interfaces.IBlock = this.stateMachine.stateStore.getLastBlock();

            let savedStatesPath: string = this.configuration.get("savedStatesPath") as string;
            if (!savedStatesPath.endsWith("/")) {
                savedStatesPath += "/";
            }

            const stateFile: string = savedStatesPath + block.data.id!.toString();
            const tempFile: string = stateFile + ".tmp";

            if (existsSync(stateFile) || existsSync(tempFile)) {
                return;
            }
            const fd: number = openSync(tempFile, "w");

            const length: number = Object.keys(this.walletRepository.allByAddress()).length;

            const buffer: Utils.ByteBuffer = new Utils.ByteBuffer(Buffer.alloc(5 * 1024 * 1024));
            const secondaryBuffer: Utils.ByteBuffer = new Utils.ByteBuffer(Buffer.alloc(5 * 1024 * 1024));

            const flush = () => {
                writeSync(fd, buffer.getResult());
                buffer.reset();
            };

            const version: string = this.app.version();

            buffer.writeUInt8(version.length);
            buffer.writeBuffer(Buffer.from(version));
            buffer.writeUInt32LE(block.data.height);
            buffer.writeUInt32LE(length);

            for (const wallet of this.walletRepository.allByAddress()) {
                const attributes: Record<string, any> = wallet.getAttributes();
                const stateHistory: Record<string, object[]> = wallet.getAllStateHistory();
                const voteBalances: Record<string, Utils.BigNumber> = wallet.getVoteBalances();

                let bits: number = 0;

                if (!wallet.getBalance().isZero()) {
                    bits += 1;
                }

                if (!wallet.getNonce().isEqualTo(1)) {
                    bits += 2;
                }

                if (wallet.getPublicKey()) {
                    bits += 4;
                }

                if (Object.keys(attributes).length > 0) {
                    bits += 8;
                }

                if (Object.keys(voteBalances).length > 0) {
                    bits += 16;
                }

                if (Object.keys(stateHistory).length > 0) {
                    bits += 32;
                }

                if (buffer.getRemainderLength() === 0) {
                    flush();
                }
                buffer.writeUInt8(bits);

                const addressBuffer: Buffer = Buffer.from(wallet.getAddress());
                if (buffer.getRemainderLength() < addressBuffer.length) {
                    flush();
                }
                buffer.writeBuffer(addressBuffer);

                if (!wallet.getBalance().isZero()) {
                    if (buffer.getRemainderLength() < 8) {
                        flush();
                    }
                    buffer.writeBigInt64LE(wallet.getBalance().toBigInt());
                }

                if (!wallet.getNonce().isEqualTo(1)) {
                    if (buffer.getRemainderLength() < 8) {
                        flush();
                    }
                    buffer.writeBigUInt64LE(wallet.getNonce().toBigInt());
                }

                if (wallet.getPublicKey()) {
                    const publicKey: Buffer = Buffer.from(wallet.getPublicKey()!, "hex");
                    if (buffer.getRemainderLength() < publicKey.length) {
                        flush();
                    }
                    buffer.writeBuffer(publicKey);
                }

                for (const item of [attributes, voteBalances, stateHistory]) {
                    if (Object.keys(item).length > 0) {
                        secondaryBuffer.reset();
                        this.byteBufferArray.reset();

                        const encoded: Buffer = this.encode(item, secondaryBuffer);
                        if (buffer.getRemainderLength() < 8) {
                            flush();
                        }
                        buffer.writeUInt32LE(encoded.length);

                        if (buffer.getRemainderLength() < encoded.length) {
                            flush();
                        }
                        buffer.writeBuffer(encoded);
                    }
                }
            }

            flush();
            closeSync(fd);

            renameSync(tempFile, stateFile);
            readdirSync(savedStatesPath)
                .filter((file) => file.endsWith(".tmp") || statSync(savedStatesPath + file).size === 0)
                .map((file) => unlinkSync(savedStatesPath + file));

            const maxSavedStates: number = this.configuration.get("maxSavedStates") as number;
            if (maxSavedStates > 0) {
                readdirSync(savedStatesPath)
                    .map((file) => ({ name: file, time: statSync(savedStatesPath + file).mtime.getTime() }))
                    .sort((a, b) => b.time - a.time)
                    .slice(maxSavedStates)
                    .map((file) => unlinkSync(savedStatesPath + file.name));
            }
        } catch (error) {
            this.logger.error("An error occurred while trying to save the state :warning:");
            this.logger.error(error.stack);
        }
    }

    private encode(object: string | number | Record<string, any>, buffer: Utils.ByteBuffer) {
        switch (typeof object) {
            case "string": {
                if (!(/^[0-9a-f]+$/.test(object) && object.length % 2 === 0)) {
                    buffer.writeUInt32LE(object.length + 1);
                    buffer.writeUInt8(SavedStateValueType.String);
                    buffer.writeBuffer(Buffer.from(object));
                } else {
                    const hexBuffer = Buffer.from(object, "hex");
                    buffer.writeUInt32LE(hexBuffer.length + 1);
                    buffer.writeUInt8(SavedStateValueType.HexString);
                    buffer.writeBuffer(hexBuffer);
                }
                break;
            }
            case "boolean": {
                buffer.writeUInt32LE(2);
                buffer.writeUInt8(SavedStateValueType.Boolean);
                buffer.writeUInt8(object ? 1 : 0);
                break;
            }
            case "number": {
                if (object % 1 !== 0) {
                    const stringifiedObject: string = object.toString();
                    buffer.writeUInt32LE(stringifiedObject.length + 1);
                    buffer.writeUInt8(SavedStateValueType.Decimal);
                    buffer.writeBuffer(Buffer.from(stringifiedObject));
                } else {
                    buffer.writeUInt32LE(5);
                    if (object >= 0) {
                        buffer.writeUInt8(SavedStateValueType.Integer);
                        buffer.writeUInt32LE(object);
                    } else {
                        buffer.writeUInt8(SavedStateValueType.Signed);
                        buffer.writeInt32LE(object);
                    }
                }
                break;
            }
            case "object": {
                if (object instanceof Utils.BigNumber) {
                    buffer.writeUInt32LE(9);
                    if (!object.isNegative()) {
                        buffer.writeUInt8(SavedStateValueType.BigNumber);
                        buffer.writeBigUInt64LE(object.toBigInt());
                    } else {
                        buffer.writeUInt8(SavedStateValueType.SignedBigNumber);
                        buffer.writeBigInt64LE(object.toBigInt());
                    }
                } else if (object instanceof Array || object instanceof Set) {
                    const arrayBuffer: Utils.ByteBuffer = this.byteBufferArray.getByteBuffer();
                    for (const value of object) {
                        this.encode(value, arrayBuffer);
                    }
                    const bufferResult: Buffer = arrayBuffer.getResult();
                    buffer.writeUInt32LE(bufferResult.length + 1);
                    buffer.writeUInt8(object instanceof Array ? SavedStateValueType.Array : SavedStateValueType.Set);
                    buffer.writeBuffer(bufferResult);
                } else if (object instanceof Object) {
                    const objectBuffer: Utils.ByteBuffer = this.byteBufferArray.getByteBuffer();
                    for (const property in object) {
                        if (object.hasOwnProperty(property)) {
                            this.encode(property, objectBuffer);
                            this.encode(object[property], objectBuffer);
                        }
                    }
                    const bufferResult: Buffer = objectBuffer.getResult();
                    buffer.writeUInt32LE(bufferResult.length + 1);
                    buffer.writeUInt8(SavedStateValueType.Object);
                    buffer.writeBuffer(bufferResult);
                } else {
                    buffer.writeUInt32LE(1);
                    buffer.writeUInt8(SavedStateValueType.Null);
                }
                break;
            }
            case "undefined": {
                buffer.writeUInt32LE(1);
                buffer.writeUInt8(SavedStateValueType.Undefined);
            }
        }
        return buffer.getResult();
    }
}
