import { Interfaces, Utils } from "@solar-network/crypto";
import { Application, Container, Contracts, Providers } from "@solar-network/kernel";
import { closeSync, existsSync, openSync, readdirSync, renameSync, statSync, unlinkSync, writeSync } from "fs";

@Container.injectable()
export class StateSaver {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Application;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/state")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.StateMachine)
    private readonly stateMachine;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

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
                const publicKeys: Record<string, string | Contracts.State.WalletPermissions> = wallet.getPublicKeys();
                const voteBalances: Map<string, Utils.BigNumber> = wallet.getVoteBalances();

                let bits: number = 0;

                if (!wallet.getBalance().isZero()) {
                    bits += 1;
                }

                if (!wallet.getNonce().isEqualTo(1)) {
                    bits += 2;
                }

                if (Object.keys(attributes).length > 0) {
                    bits += 4;
                }

                if (Object.keys(publicKeys).length > 0) {
                    bits += 8;
                }

                if (voteBalances.size > 0) {
                    bits += 16;
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

                for (const item of [attributes, publicKeys, [...voteBalances]]) {
                    if (Object.keys(item).length > 0) {
                        secondaryBuffer.reset();
                        const encoded: Buffer = Buffer.from(
                            JSON.stringify(item, (_, value) => {
                                if (value instanceof Map) {
                                    return [...value];
                                }
                                return value;
                            }),
                        );
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
            this.logger.error("An error occurred while trying to save the state");
            this.logger.error(error.stack);
        }
    }
}
