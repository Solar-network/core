import { Interfaces, Utils } from "@solar-network/crypto";
import { Repositories } from "@solar-network/database";
import { Container, Contracts, Services, Utils as AppUtils } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

import {
    AcceptBlockHandler,
    AlreadyForgedHandler,
    ExceptionHandler,
    InvalidGeneratorHandler,
    InvalidRewardHandler,
    NonceOutOfOrderHandler,
    UnchainedHandler,
    VerificationFailedHandler,
} from "./handlers";

export enum BlockProcessorResult {
    Accepted,
    DiscardedButCanBeBroadcasted,
    Rejected,
    Rollback,
    Reverted,
    Corrupted,
}

@Container.injectable()
export class BlockProcessor {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.RoundState)
    private readonly roundState!: Contracts.State.RoundState;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private readonly transactionRepository!: Repositories.TransactionRepository;

    @Container.inject(Container.Identifiers.TriggerService)
    private readonly triggers!: Services.Triggers.Triggers;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async process(block: Interfaces.IBlock): Promise<BlockProcessorResult> {
        if (Utils.isException({ ...block.data, transactions: block.transactions.map((tx) => tx.data) })) {
            return this.app.resolve<ExceptionHandler>(ExceptionHandler).execute(block);
        }

        if (!(await this.verifyBlock(block))) {
            return this.app.resolve<VerificationFailedHandler>(VerificationFailedHandler).execute(block);
        }

        if (this.blockContainsOutOfOrderNonce(block)) {
            return this.app.resolve<NonceOutOfOrderHandler>(NonceOutOfOrderHandler).execute();
        }

        const blockTimeLookup = await AppUtils.forgingInfoCalculator.getBlockTimeLookup(this.app, block.data.height);

        const isValidGenerator: boolean = await this.validateGenerator(block);
        const isChained: boolean = AppUtils.isBlockChained(
            this.blockchain.getLastBlock().data,
            block.data,
            blockTimeLookup,
        );
        if (!isChained) {
            return this.app.resolve<UnchainedHandler>(UnchainedHandler).initialise(isValidGenerator).execute(block);
        }

        if (!isValidGenerator) {
            return this.app.resolve<InvalidGeneratorHandler>(InvalidGeneratorHandler).execute(block);
        }

        if (!(await this.validateReward(block))) {
            return this.app.resolve<InvalidRewardHandler>(InvalidRewardHandler).execute(block);
        }

        const containsForgedTransactions: boolean = await this.checkBlockContainsForgedTransactions(block);
        if (containsForgedTransactions) {
            return this.app.resolve<AlreadyForgedHandler>(AlreadyForgedHandler).execute(block);
        }

        return this.app.resolve<AcceptBlockHandler>(AcceptBlockHandler).execute(block);
    }

    private async verifyBlock(block: Interfaces.IBlock): Promise<boolean> {
        if (block.verification.containsMultiSignatures) {
            try {
                for (const transaction of block.transactions) {
                    const registry = this.app.getTagged<Handlers.Registry>(
                        Container.Identifiers.TransactionHandlerRegistry,
                        "state",
                        "blockchain",
                    );
                    const handler = await registry.getActivatedHandlerForData(transaction.data);
                    await handler.verify(transaction);
                }

                block.verification = block.verify();
            } catch (error) {
                this.logger.warning(`Failed to verify block, because: ${error.message} :bangbang:`);
                block.verification.verified = false;
            }
        }

        const { verified } = block.verification;
        if (!verified) {
            this.logger.warning(
                `Block ${block.data.height.toLocaleString()} (${
                    block.data.id
                }) disregarded because verification failed :scroll:`,
            );

            this.logger.warning(JSON.stringify(block.verification, undefined, 4));

            return false;
        }

        return true;
    }

    private async checkBlockContainsForgedTransactions(block: Interfaces.IBlock): Promise<boolean> {
        if (block.transactions.length > 0) {
            const transactionIds = block.transactions.map((tx) => {
                AppUtils.assert.defined<string>(tx.id);

                return tx.id;
            });

            const forgedIds: string[] = await this.transactionRepository.getForgedTransactionsIds(transactionIds);

            if (this.stateStore.getLastBlock().data.height !== this.stateStore.getLastStoredBlockHeight()) {
                const transactionIdsSet = new Set<string>(transactionIds);

                for (const stateBlock of this.stateStore
                    .getLastBlocks()
                    .filter((block) => block.data.height > this.stateStore.getLastStoredBlockHeight())) {
                    stateBlock.transactions.forEach((tx) => {
                        AppUtils.assert.defined<string>(tx.id);

                        if (transactionIdsSet.has(tx.id)) {
                            forgedIds.push(tx.id);
                        }
                    });
                }
            }

            if (forgedIds.length > 0) {
                this.logger.warning(
                    `Block ${block.data.height.toLocaleString()} disregarded, because it contains already forged transactions :scroll:`,
                );

                this.logger.debug(`${JSON.stringify(forgedIds, undefined, 4)}`);

                return true;
            }
        }

        return false;
    }

    /**
     * For a given sender, transactions must have strictly increasing nonce without gaps.
     */
    private blockContainsOutOfOrderNonce(block: Interfaces.IBlock): boolean {
        const nonceBySender = {};

        for (const transaction of block.transactions) {
            const data = transaction.data;

            AppUtils.assert.defined<string>(data.senderPublicKey);

            const sender: string = data.senderPublicKey;

            if (nonceBySender[sender] === undefined) {
                nonceBySender[sender] = this.walletRepository.getNonce(sender);
            }

            AppUtils.assert.defined<string>(data.nonce);

            const nonce: Utils.BigNumber = data.nonce;

            if (!nonceBySender[sender].plus(1).isEqualTo(nonce)) {
                this.logger.warning(
                    `Block { height: ${block.data.height.toLocaleString()}, id: ${block.data.id} } ` +
                        `not accepted: invalid nonce order for sender ${sender}: ` +
                        `preceding nonce: ${nonceBySender[sender].toFixed()}, ` +
                        `transaction ${data.id} has nonce ${nonce.toFixed()} :bangbang:`,
                );
                return true;
            }

            nonceBySender[sender] = nonce;
        }

        return false;
    }

    private async validateGenerator(block: Interfaces.IBlock): Promise<boolean> {
        const walletRepository = this.app.getTagged<Contracts.State.WalletRepository>(
            Container.Identifiers.WalletRepository,
            "state",
            "blockchain",
        );

        if (!walletRepository.hasByPublicKey(block.data.generatorPublicKey)) {
            return false;
        }

        const generatorWallet: Contracts.State.Wallet = walletRepository.findByPublicKey(block.data.generatorPublicKey);

        let generatorUsername: string;
        try {
            generatorUsername = generatorWallet.getAttribute("delegate.username");
        } catch {
            return false;
        }

        const blockTimeLookup = await AppUtils.forgingInfoCalculator.getBlockTimeLookup(this.app, block.data.height);

        const roundInfo: Contracts.Shared.RoundInfo = AppUtils.roundCalculator.calculateRound(block.data.height);
        const delegates: Contracts.State.Wallet[] = (await this.triggers.call("getActiveDelegates", {
            roundInfo,
        })) as Contracts.State.Wallet[];

        const forgingInfo: Contracts.Shared.ForgingInfo = AppUtils.forgingInfoCalculator.calculateForgingInfo(
            block.data.timestamp,
            block.data.height,
            blockTimeLookup,
        );

        const forgingDelegate: Contracts.State.Wallet = delegates[forgingInfo.currentForger];

        if (!forgingDelegate) {
            this.logger.debug(
                `Could not decide if delegate ${generatorUsername} is allowed to forge block ${block.data.height.toLocaleString()} :grey_question:`,
            );
        } else if (forgingDelegate.getPublicKey() !== block.data.generatorPublicKey) {
            AppUtils.assert.defined<string>(forgingDelegate.getPublicKey());

            const forgingWallet: Contracts.State.Wallet = walletRepository.findByPublicKey(
                forgingDelegate.getPublicKey()!,
            );
            const forgingUsername: string = forgingWallet.getAttribute("delegate.username");

            this.logger.warning(
                `Delegate ${generatorUsername} is not allowed to forge in this slot, should be ${forgingUsername} :-1:`,
            );

            return false;
        }

        this.logger.debug(
            `Delegate ${generatorUsername} is allowed to forge block ${block.data.height.toLocaleString()} :+1:`,
        );

        return true;
    }

    private async validateReward(block: Interfaces.IBlock): Promise<boolean> {
        const walletRepository = this.app.getTagged<Contracts.State.WalletRepository>(
            Container.Identifiers.WalletRepository,
            "state",
            "blockchain",
        );

        const generatorWallet: Contracts.State.Wallet = walletRepository.findByPublicKey(block.data.generatorPublicKey);

        const { reward } = await this.roundState.getRewardForBlockInRound(block.data.height, generatorWallet);

        if (!block.data.reward.isEqualTo(reward)) {
            this.logger.warning(
                `Block rejected as reward was ${Utils.formatSatoshi(
                    block.data.reward,
                )}, should be ${Utils.formatSatoshi(reward)} :bangbang:`,
            );
            return false;
        }

        return true;
    }
}
