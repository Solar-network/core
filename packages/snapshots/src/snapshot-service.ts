import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Utils } from "@solar-network/kernel";
import { closeSync, openSync } from "fs";

import { Database, Meta } from "./contracts";
import { Filesystem } from "./filesystem/filesystem";
import { Identifiers } from "./ioc";
import { ProgressRenderer } from "./progress-renderer";

@Container.injectable()
export class SnapshotService implements Contracts.Snapshot.SnapshotService {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Identifiers.SnapshotFilesystem)
    private readonly filesystem!: Filesystem;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Identifiers.SnapshotDatabaseService)
    private readonly database!: Database.DatabaseService;

    public async dump(options: Contracts.Snapshot.DumpOptions): Promise<void> {
        const renderer = new ProgressRenderer(this.app);

        try {
            Utils.assert.defined<string>(options.network);

            this.logger.info(`Saving snapshot for ${options.network}`, "💾");

            this.database.init(options.codec, options.skipCompression);

            await this.database.dump(options);
            renderer.spinner.succeed();

            this.logger.info(`Snapshot was saved to ${this.filesystem.getSnapshotPath()}`, "🏁");
        } catch (err) {
            renderer.spinner.fail();
            this.logger.critical("Snapshot dump failed");
            this.logger.critical(err.stack);
        }
    }

    public async restore(options: Contracts.Snapshot.RestoreOptions): Promise<void> {
        const renderer = new ProgressRenderer(this.app);

        try {
            Utils.assert.defined<string>(options.network);
            Utils.assert.defined<string>(options.blocks);

            this.filesystem.setSnapshot(options.blocks);

            if (!(await this.filesystem.snapshotExists())) {
                this.logger.critical(`Snapshot ${options.blocks} of network ${options.network} does not exist`);
                return;
            }

            let meta: Meta.MetaData;
            try {
                meta = await this.filesystem.readMetaData();
            } catch (e) {
                this.logger.critical(
                    `Metadata for snapshot ${options.blocks} of network ${options.network} is not valid`,
                );
                return;
            }

            this.logger.info(`Restoring from snapshot for ${options.network}`, "💾");

            this.database.init(meta!.codec, meta!.skipCompression, options.verify);

            await this.database.restore(meta!, { truncate: !!options.truncate });

            this.forceIntegrityCheckOnNextBoot();

            renderer.spinner.succeed();

            this.logger.info(
                `Successfully restored ${Utils.pluralise("block", meta!.blocks.count, true)}, ${Utils.pluralise(
                    "missed block",
                    meta!.missedBlocks.count,
                    true,
                )}, ${Utils.pluralise("transaction", meta!.transactions.count, true)}, ${Utils.pluralise(
                    "round",
                    meta!.rounds.count,
                    true,
                )}`,
                "🏁",
            );
        } catch (err) {
            renderer.spinner.fail();
            this.logger.critical("Snapshot restore failed");
        }
    }

    public async verify(options: Contracts.Snapshot.RestoreOptions): Promise<void> {
        const renderer = new ProgressRenderer(this.app);

        try {
            this.logger.info("Verifying snapshot", "🕵️");

            Utils.assert.defined<string>(options.network);
            Utils.assert.defined<string>(options.blocks);

            this.filesystem.setSnapshot(options.blocks);

            if (!(await this.filesystem.snapshotExists())) {
                this.logger.critical(`Snapshot ${options.blocks} of network ${options.network} does not exist`);
                return;
            }

            let meta: Meta.MetaData;
            try {
                meta = await this.filesystem.readMetaData();
            } catch (e) {
                this.logger.critical(
                    `Metadata for snapshot ${options.blocks} of network ${options.network} is not valid`,
                );
            }

            this.database.init(meta!.codec, meta!.skipCompression);

            await this.database.verify(meta!);
            renderer.spinner.succeed();
            this.logger.info("Verification was successful", "🏁");
        } catch (err) {
            renderer.spinner.fail();
            this.logger.critical("Verification failed");
            this.logger.critical(err.stack);
        }
    }

    public async rollbackByHeight(height: number): Promise<void> {
        try {
            if (!height || height <= 0) {
                this.logger.critical(`Rollback height ${height.toLocaleString()} is invalid`);
                return;
            }

            const lastBlock = await this.database.getLastBlock();

            Utils.assert.defined<Interfaces.IBlock>(lastBlock);

            const currentHeight = lastBlock.data.height;

            if (height >= currentHeight) {
                this.logger.error(
                    `Rollback height ${height.toLocaleString()} is not less than the current height ${currentHeight.toLocaleString()}`,
                );
                return;
            }

            const roundInfo = Utils.roundCalculator.calculateRound(height);

            this.logger.info("Rollback in progress", "⏪");

            const newLastBlock = await this.database.rollback(roundInfo);

            this.logger.info(
                `Rolled back blockchain to last finished round ${roundInfo.round.toLocaleString()} with last block height ${newLastBlock.data.height.toLocaleString()}`,
                "🏁",
            );

            this.forceIntegrityCheckOnNextBoot();
        } catch (err) {
            this.logger.critical("Rollback failed");
            this.logger.critical(err.stack);
        }
    }

    public async rollbackByNumber(number: number): Promise<void> {
        const lastBlock = await this.database.getLastBlock();

        return this.rollbackByHeight(lastBlock.data.height - number);
    }

    public async truncate(): Promise<void> {
        try {
            this.logger.info("Wiping the database", "🧻");

            await this.database.truncate();

            this.logger.info("Database wiped successfully", "🏁");
            this.forceIntegrityCheckOnNextBoot();
        } catch (err) {
            this.logger.critical("Wipe failed");
            this.logger.critical(err.stack);
        }
    }

    private forceIntegrityCheckOnNextBoot(): void {
        closeSync(openSync(`${process.env.CORE_PATH_TEMP}/force-integrity-check.lock`, "w"));
    }
}
