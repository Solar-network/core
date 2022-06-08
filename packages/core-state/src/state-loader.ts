import { DatabaseService, Repositories } from "@solar-network/core-database";
import { Application, Container, Contracts, Enums, Providers, Utils as AppUtils } from "@solar-network/core-kernel";
import { Interfaces, Utils } from "@solar-network/crypto";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "fs";
import { resolve } from "path";
import semver from "semver";

import { SavedStateValueType } from "./enums";
import {
    BlockNotInDatabaseError,
    CorruptSavedStateError,
    IncompatibleSavedStateError,
    StaleSavedStateError,
} from "./errors";

@Container.injectable()
export class StateLoader {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Application;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    private readonly blockRepository!: Repositories.BlockRepository;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/core-state")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.DatabaseService)
    private readonly databaseService!: DatabaseService;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.StateMachine)
    private readonly stateMachine;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async run(): Promise<boolean> {
        let savedStatesPath: string = this.configuration.get("savedStatesPath") as string;

        if (existsSync(savedStatesPath) && !lstatSync(savedStatesPath).isDirectory()) {
            unlinkSync(savedStatesPath);
        }

        if (!savedStatesPath.endsWith("/")) {
            savedStatesPath += "/";
        }

        if (!existsSync(savedStatesPath)) {
            try {
                mkdirSync(savedStatesPath, { recursive: true });
            } catch (error) {
                this.logger.error(`Could not create saved states path at ${savedStatesPath} :warning:`);
            }
        }

        const purgeLock: string = `${process.env.CORE_PATH_TEMP}/purge-saved-states.lock`;

        if (existsSync(purgeLock)) {
            try {
                unlinkSync(purgeLock);
            } catch {
                //
            }

            try {
                for (const file of readdirSync(savedStatesPath)) {
                    unlinkSync(`${savedStatesPath}/${file}`);
                }
            } catch {
                //
            }
        }

        readdirSync(savedStatesPath)
            .filter((file) => file.endsWith(".tmp") || statSync(savedStatesPath + file).size < 8)
            .map((file) => unlinkSync(savedStatesPath + file));

        const stateFiles: Array<string> = readdirSync(savedStatesPath)
            .map((file) => ({ name: file, time: statSync(savedStatesPath + file).mtime.getTime() }))
            .sort((a, b) => b.time - a.time)
            .map((file) => file.name);

        let result: boolean;
        if (stateFiles.length === 0) {
            this.logger.info("No saved states exist so a fresh state will now be generated :bangbang:");
            result = false;
        } else {
            result = await this.load(savedStatesPath, stateFiles);
        }

        const queue: Contracts.Kernel.Queue = this.blockchain.getQueue();
        if (queue) {
            const stateSaver: Contracts.State.StateSaver = this.app.get<Contracts.State.StateSaver>(
                Container.Identifiers.StateSaver,
            );
            queue.removeAllListeners("drain");
            queue.on("drain", async () => {
                await stateSaver.run();
                this.blockchain.dispatch("PROCESSFINISHED");
            });
        }

        return result;
    }

    private decode(buffer: Utils.ByteBuffer): any {
        const length: number = buffer.readUInt32LE();
        const objectBuffer: Utils.ByteBuffer = new Utils.ByteBuffer(buffer.readBuffer(length));

        const type: number = objectBuffer.readUInt8();

        switch (type) {
            case SavedStateValueType.String: {
                return objectBuffer.readBuffer(length - 1).toString();
            }
            case SavedStateValueType.HexString: {
                return objectBuffer.readBuffer(length - 1).toString("hex");
            }
            case SavedStateValueType.Boolean: {
                return objectBuffer.readUInt8() === 1;
            }
            case SavedStateValueType.Decimal: {
                return parseFloat(objectBuffer.readBuffer(length - 1).toString());
            }
            case SavedStateValueType.Integer: {
                return objectBuffer.readUInt32LE();
            }
            case SavedStateValueType.Signed: {
                return objectBuffer.readInt32LE();
            }
            case SavedStateValueType.BigNumber: {
                return Utils.BigNumber.make(objectBuffer.readBigUInt64LE());
            }
            case SavedStateValueType.SignedBigNumber: {
                return Utils.BigNumber.make(objectBuffer.readBigInt64LE());
            }
            case SavedStateValueType.Array:
            case SavedStateValueType.Set: {
                const array: any[] = [];
                while (objectBuffer.getRemainderLength() > 0) {
                    array.push(this.decode(objectBuffer));
                }
                return type == SavedStateValueType.Array ? array : new Set(array);
            }
            case SavedStateValueType.Object: {
                const object: object = {};
                while (objectBuffer.getRemainderLength() > 0) {
                    object[this.decode(objectBuffer)] = this.decode(objectBuffer);
                }
                return object;
                break;
            }
            case SavedStateValueType.Null: {
                return null;
                break;
            }
        }

        return undefined;
    }

    private async load(savedStatesPath: string, stateFiles: Array<string>): Promise<boolean> {
        this.walletRepository.reset();

        if (stateFiles.length === 0) {
            this.logger.info("There are no more saved states to try so a fresh state will now be generated :bangbang:");
            return false;
        }

        const stateFile: string = stateFiles.shift() as string;

        let success: boolean = false;

        let blocksFromOurHeight: number = 0;
        let height: number = 0;

        let block: Interfaces.IBlock = this.stateMachine.stateStore.getLastBlock();

        try {
            const buffer: Utils.ByteBuffer = new Utils.ByteBuffer(readFileSync(savedStatesPath + stateFile));

            const savedStateVersion: string = buffer.readBuffer(buffer.readUInt8()).toString();
            height = buffer.readUInt32LE();
            const { minimumSavedStateVersion } = require(resolve(__dirname, "../package.json"));
            if (!semver.gte(savedStateVersion, minimumSavedStateVersion)) {
                throw new IncompatibleSavedStateError(height);
            }

            if (block.data.id !== stateFile || block.data.height !== height) {
                const blockFromDatabase: Interfaces.IBlockData = (await this.databaseService.findBlockByID([
                    stateFile,
                ]))![0];
                if (!blockFromDatabase || blockFromDatabase.id !== stateFile || blockFromDatabase.height !== height) {
                    throw new BlockNotInDatabaseError(height);
                }
                blocksFromOurHeight = block.data.height - height;
                if (blocksFromOurHeight > (this.configuration.get("maxSavedStateAge") as number)) {
                    throw new StaleSavedStateError(height, block.data.height);
                }
            }

            this.logger.info("Restoring previously saved state :floppy_disk:");

            const total: number = buffer.readUInt32LE();

            try {
                for (let count = 0; count < total; count++) {
                    const bits: number = buffer.readUInt8();

                    const address: string = buffer.readBuffer(34).toString();

                    let attributes: object = {};
                    let balance: bigint | number = 0;
                    let nonce: bigint | number = 1;
                    let publicKey: string | undefined;
                    let voteBalances: object = {};

                    if ((1 & bits) !== 0) {
                        balance = buffer.readBigInt64LE();
                    }

                    if ((2 & bits) !== 0) {
                        nonce = buffer.readBigUInt64LE();
                    }

                    if ((4 & bits) !== 0) {
                        publicKey = buffer.readBuffer(33).toString("hex");
                    }

                    if ((8 & bits) !== 0) {
                        const length: number = buffer.readUInt32LE();
                        attributes = this.decode(new Utils.ByteBuffer(buffer.readBuffer(length)));
                    }

                    if ((16 & bits) !== 0) {
                        const length: number = buffer.readUInt32LE();
                        voteBalances = this.decode(new Utils.ByteBuffer(buffer.readBuffer(length)));
                    }

                    const wallet: Contracts.State.Wallet = this.walletRepository.createWallet(address);

                    wallet.setBalance(Utils.BigNumber.make(balance));
                    wallet.setNonce(Utils.BigNumber.make(nonce));

                    if (publicKey) {
                        wallet.setPublicKey(publicKey);
                    }

                    for (const attribute of Object.keys(attributes)) {
                        wallet.setAttribute(attribute, attributes[attribute]);
                    }

                    for (const delegate of Object.keys(voteBalances)) {
                        wallet.setVoteBalance(delegate, voteBalances[delegate]);
                    }

                    this.walletRepository.index(wallet);
                }
            } catch (error) {
                throw new CorruptSavedStateError(height);
            }

            const delegates: number = Object.keys(this.walletRepository.allByUsername()).length;

            if (delegates === 0) {
                throw new CorruptSavedStateError(height);
            }

            if (blocksFromOurHeight > 0) {
                this.logger.info(
                    `Restored state is ${blocksFromOurHeight.toLocaleString()} ${AppUtils.pluralize(
                        "block",
                        blocksFromOurHeight,
                    )} behind so the blockchain will roll back to height ${height.toLocaleString()} :repeat:`,
                );
                await this.blockRepository.deleteTopBlocks(blocksFromOurHeight);
                block = await this.databaseService.getLastBlock();
                this.stateMachine.stateStore.setLastBlock(block);
                this.stateMachine.stateStore.setLastStoredBlockHeight(block.data.height);
                this.logger.info(`Last block in database: ${block.data.height.toLocaleString()}`);
            }

            this.logger.info(`Number of registered delegates: ${delegates.toLocaleString()}`);

            this.events.dispatch(Enums.StateEvent.BuilderFinished);

            success = true;
        } catch (error) {
            unlinkSync(savedStatesPath + stateFile);
            this.logger.warning(`${error.message} :warning:`);
            if (stateFiles.length > 0) {
                try {
                    const buffer: Utils.ByteBuffer = new Utils.ByteBuffer(
                        readFileSync(savedStatesPath + stateFiles[0]),
                    );
                    buffer.readBuffer(buffer.readUInt8());

                    height = buffer.readUInt32LE();
                    this.logger.info(`Trying an earlier saved state from height ${height.toLocaleString()}...`);
                } catch {
                    //
                }
            }
            return this.load(savedStatesPath, stateFiles);
        }

        return success;
    }
}
