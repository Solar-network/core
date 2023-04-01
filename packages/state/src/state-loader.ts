import { Interfaces, Utils } from "@solar-network/crypto";
import { DatabaseService } from "@solar-network/database";
import { Container, Contracts, Enums, Providers, Utils as AppUtils } from "@solar-network/kernel";
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, unlinkSync } from "fs";
import { resolve } from "path";
import semver from "semver";

import {
    BlockNotInDatabaseError,
    CorruptSavedStateError,
    IncompatibleSavedStateError,
    StaleSavedStateError,
} from "./errors";

@Container.injectable()
export class StateLoader {
    @Container.inject(Container.Identifiers.DatabaseBlockRepository)
    private readonly blockRepository!: Contracts.Database.BlockRepository;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/state")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.DatabaseService)
    private readonly databaseService!: DatabaseService;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    @Container.tagged("package", "state")
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
                this.logger.error(`Could not create saved states path at ${savedStatesPath}`);
            }
        }

        const clearLock: string = `${process.env.SOLAR_CORE_PATH_TEMP}/clear-saved-states.lock`;

        if (existsSync(clearLock)) {
            try {
                unlinkSync(clearLock);
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
            this.logger.info("No saved states exist so a fresh state will now be generated", "❗");
            result = false;
        } else {
            result = await this.load(savedStatesPath, stateFiles);
        }

        return result;
    }

    private async load(savedStatesPath: string, stateFiles: Array<string>): Promise<boolean> {
        this.walletRepository.reset();

        if (stateFiles.length === 0) {
            this.logger.info("There are no more saved states to try so a fresh state will now be generated", "❗");
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
                const blockFromDatabase: Interfaces.IBlockData = (await this.databaseService.findBlocksById([
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

            this.logger.info("Restoring previously saved state", "🚀");

            const total: number = buffer.readUInt32LE();

            const reviver = (_, value) => {
                if (typeof value === "string" && !value.includes(".") && !isNaN(+value) && Number.isInteger(+value)) {
                    return Utils.BigNumber.make(value);
                }

                return value;
            };

            try {
                for (let count = 0; count < total; count++) {
                    const bits: number = buffer.readUInt8();

                    const address: string = buffer.readBuffer(34).toString();

                    let attributes: Record<string, any> = {};
                    let balance: bigint | number = 0;
                    let nonce: bigint | number = 1;
                    let publicKeys: Record<string, string | Contracts.State.WalletPermissions> = {};
                    let transactions: Contracts.State.WalletTransactions = {
                        received: { total: 0 },
                        sent: { total: 0 },
                    };
                    let voteBalances: Map<string, Utils.BigNumber> = new Map();

                    if ((1 & bits) !== 0) {
                        balance = buffer.readBigInt64LE();
                    }

                    if ((2 & bits) !== 0) {
                        nonce = buffer.readBigUInt64LE();
                    }

                    if ((4 & bits) !== 0) {
                        const length: number = buffer.readUInt32LE();
                        attributes = JSON.parse(buffer.readBuffer(length).toString(), reviver);
                        if (attributes.votes) {
                            attributes.votes = new Map(attributes.votes);
                        }
                        if (attributes.hidden?.previousVotes) {
                            attributes.hidden.previousVotes = new Map(attributes.hidden.previousVotes);
                        }
                    }

                    if ((8 & bits) !== 0) {
                        const length: number = buffer.readUInt32LE();
                        publicKeys = JSON.parse(buffer.readBuffer(length).toString(), reviver);
                    }

                    if ((16 & bits) !== 0) {
                        const length: number = buffer.readUInt32LE();
                        transactions = JSON.parse(buffer.readBuffer(length).toString(), reviver);
                    }

                    if ((32 & bits) !== 0) {
                        const length: number = buffer.readUInt32LE();
                        voteBalances = new Map(JSON.parse(buffer.readBuffer(length).toString(), reviver));
                    }

                    const wallet: Contracts.State.Wallet = this.walletRepository.createWallet(address);

                    wallet.setBalance(Utils.BigNumber.make(balance));
                    wallet.setNonce(Utils.BigNumber.make(nonce));

                    for (const attribute of Object.keys(attributes)) {
                        wallet.setAttribute(attribute, attributes[attribute]);
                    }

                    wallet.setPublicKeys(publicKeys);

                    wallet.setTransactions(transactions);

                    wallet.setVoteBalances(voteBalances);

                    this.walletRepository.index(wallet);
                }
            } catch (error) {
                throw new CorruptSavedStateError(height);
            }

            const usernames: number = Object.keys(this.walletRepository.allByUsername()).length;

            if (usernames === 0) {
                throw new CorruptSavedStateError(height);
            }

            if (blocksFromOurHeight > 0) {
                this.logger.info(
                    `Restored state is ${AppUtils.pluralise(
                        "block",
                        blocksFromOurHeight,
                        true,
                    )} behind so the blockchain will roll back to height ${height.toLocaleString()}`,
                    "⏪",
                );
                await this.blockRepository.deleteTop(blocksFromOurHeight);
                block = await this.databaseService.getLastBlock();
                this.stateMachine.stateStore.setLastBlock(block);
                this.stateMachine.stateStore.setLastStoredBlockHeight(block.data.height);
                this.logger.info(`Last block in database: ${block.data.height.toLocaleString()}`, "🗄️");
            }

            this.walletRepository.updateWalletRanks();
            this.events.dispatch(Enums.StateEvent.BuilderFinished);

            success = true;
        } catch (error) {
            unlinkSync(savedStatesPath + stateFile);
            this.logger.warning(`${error.message}`);
            if (stateFiles.length > 0) {
                try {
                    const buffer: Utils.ByteBuffer = new Utils.ByteBuffer(
                        readFileSync(savedStatesPath + stateFiles[0]),
                    );
                    buffer.readBuffer(buffer.readUInt8());

                    height = buffer.readUInt32LE();
                    this.logger.info(`Trying an earlier saved state from height ${height.toLocaleString()}...`, "🙏");
                } catch {
                    //
                }
            }
            return this.load(savedStatesPath, stateFiles);
        }

        return success;
    }
}
