import { Enums, Identities, Interfaces, Utils } from "@solar-network/crypto";
import { Repositories } from "@solar-network/database";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

// todo: review the implementation
@Container.injectable()
export class BlockState implements Contracts.State.BlockState {
    @Container.inject(Container.Identifiers.BlockHistoryService)
    private readonly blockHistoryService!: Contracts.Shared.BlockHistoryService;

    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    private handlerRegistry!: Handlers.Registry;

    @Container.inject(Container.Identifiers.LogService)
    private logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly state!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private readonly transactionRepository!: Repositories.TransactionRepository;

    @Container.inject(Container.Identifiers.WalletRepository)
    private walletRepository!: Contracts.State.WalletRepository;

    public async applyBlock(
        block: Interfaces.IBlock,
        transactionProcessing: {
            index: number | undefined;
        },
    ): Promise<void> {
        let forgerWallet: Contracts.State.Wallet;

        if (block.data.height === 1) {
            this.initGenesisForgerWallet(block.data.generatorPublicKey);
            forgerWallet = this.walletRepository.findByPublicKey(block.data.generatorPublicKey);
        } else {
            forgerWallet = this.walletRepository.findByUsername(block.data.username!);
        }

        const previousBlock = this.state.getLastBlock();

        const appliedTransactions: Interfaces.ITransaction[] = [];
        try {
            for (const transaction of block.transactions) {
                transactionProcessing.index = appliedTransactions.length;
                await this.applyTransaction(block.data.height, transaction);
                transactionProcessing.index = undefined;
                appliedTransactions.push(transaction);
            }
            this.applyBlockToForger(forgerWallet, block);

            this.state.setLastBlock(block);
        } catch (error) {
            for (const transaction of appliedTransactions.reverse()) {
                await this.revertTransaction(block.data.height, transaction);
            }

            this.state.setLastBlock(previousBlock);

            throw error;
        }
    }

    public async revertBlock(block: Interfaces.IBlock): Promise<void> {
        const forgerWallet = this.walletRepository.findByUsername(block.data.username!);

        const revertedTransactions: Interfaces.ITransaction[] = [];
        try {
            await this.revertBlockFromForger(forgerWallet, block);

            for (const transaction of block.transactions.slice().reverse()) {
                await this.revertTransaction(block.data.height, transaction);
                revertedTransactions.push(transaction);
            }
        } catch (error) {
            this.logger.error(error.stack);
            this.logger.error("Failed to revert all transactions in block - applying previous transactions");
            for (const transaction of revertedTransactions.reverse()) {
                await this.applyTransaction(block.data.height, transaction);
            }
            throw error;
        }
    }

    public async applyTransaction(height: number, transaction: Interfaces.ITransaction): Promise<void> {
        transaction.setBurnedFee(height);

        const transactionHandler = await this.handlerRegistry.getActivatedHandlerForData(transaction.data);

        let lockSenderWallet: Contracts.State.Wallet | undefined;
        let lockRecipientWallet: Contracts.State.Wallet | undefined;
        if (
            transaction.type === Enums.TransactionType.Core.HtlcClaim &&
            transaction.typeGroup === Enums.TransactionTypeGroup.Core
        ) {
            AppUtils.assert.defined<Interfaces.IHtlcClaimAsset>(transaction.data.asset?.claim);

            const lockId = transaction.data.asset.claim.lockTransactionId;
            lockSenderWallet = this.walletRepository.findByIndex(Contracts.State.WalletIndexes.Locks, lockId);

            const locks: Interfaces.IHtlcLocks = lockSenderWallet.getAttribute("htlc.locks", {});

            let recipientId: string | undefined;

            if (locks[lockId] && locks[lockId].recipientId) {
                recipientId = locks[lockId].recipientId;
            } else {
                const lockTransaction: Interfaces.ITransactionData = (
                    await this.transactionRepository.findByIds([lockId])
                )[0];

                recipientId = lockTransaction.recipientId;
            }

            AppUtils.assert.defined<Interfaces.ITransactionData>(recipientId);

            lockRecipientWallet = this.walletRepository.findByAddress(recipientId);
        }

        await transactionHandler.apply(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const sender: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        let recipient: Contracts.State.Wallet | undefined;
        if (transaction.data.recipientId) {
            AppUtils.assert.defined<string>(transaction.data.recipientId);

            recipient = this.walletRepository.findByAddress(transaction.data.recipientId);
        }

        this.updateVoteBalances(sender, recipient!, transaction.data, lockSenderWallet!, lockRecipientWallet!);
    }

    public async revertTransaction(height: number, transaction: Interfaces.ITransaction): Promise<void> {
        transaction.setBurnedFee(height);

        const { data } = transaction;

        const transactionHandler = await this.handlerRegistry.getActivatedHandlerForData(transaction.data);

        AppUtils.assert.defined<string>(data.senderId);

        const sender: Contracts.State.Wallet = this.walletRepository.findByAddress(data.senderId);

        let recipient: Contracts.State.Wallet | undefined;
        if (transaction.data.recipientId) {
            AppUtils.assert.defined<string>(transaction.data.recipientId);

            recipient = this.walletRepository.findByAddress(transaction.data.recipientId);
        }

        await transactionHandler.revert(transaction);

        let lockSenderWallet: Contracts.State.Wallet | undefined;
        let lockRecipientWallet: Contracts.State.Wallet | undefined;
        if (
            transaction.type === Enums.TransactionType.Core.HtlcClaim &&
            transaction.typeGroup === Enums.TransactionTypeGroup.Core
        ) {
            AppUtils.assert.defined<Interfaces.IHtlcClaimAsset>(transaction.data.asset?.claim);

            const lockId = transaction.data.asset.claim.lockTransactionId;
            lockSenderWallet = this.walletRepository.findByIndex(Contracts.State.WalletIndexes.Locks, lockId);

            const lockTransaction: Interfaces.ITransactionData = (
                await this.transactionRepository.findByIds([lockId])
            )[0];

            AppUtils.assert.defined<Interfaces.ITransactionData>(lockTransaction.recipientId);

            lockRecipientWallet = this.walletRepository.findByAddress(lockTransaction.recipientId);
        }

        this.updateVoteBalances(sender, recipient!, data, lockSenderWallet!, lockRecipientWallet!);
    }

    public updateWalletVoteBalance(wallet: Contracts.State.Wallet): void {
        AppUtils.decreaseVoteBalances(wallet, { walletRepository: this.walletRepository });
        wallet.updateVoteBalances();
        AppUtils.increaseVoteBalances(wallet, { walletRepository: this.walletRepository });
    }

    private applyBlockToForger(forgerWallet: Contracts.State.Wallet, block: Interfaces.IBlock) {
        const delegateAttribute = forgerWallet.getAttribute<Contracts.State.WalletDelegateAttributes>("delegate");
        const donations: Utils.BigNumber = Object.values(block.data.donations!).reduce(
            (curr, prev) => prev.plus(curr),
            Utils.BigNumber.ZERO,
        );

        delegateAttribute.producedBlocks++;
        delegateAttribute.burnedFees = delegateAttribute.burnedFees.plus(block.data.burnedFee!);
        delegateAttribute.forgedFees = delegateAttribute.forgedFees.plus(block.data.totalFee);
        delegateAttribute.forgedRewards = delegateAttribute.forgedRewards.plus(block.data.reward);
        delegateAttribute.donations = delegateAttribute.donations.plus(donations);
        delegateAttribute.lastBlock = block.data.id;

        const balanceIncrease = block.data.reward
            .minus(donations)
            .plus(block.data.totalFee.minus(block.data.burnedFee!));

        forgerWallet.increaseBalance(balanceIncrease);
        this.updateWalletVoteBalance(forgerWallet);

        for (const [address, amount] of Object.entries(block.data.donations!)) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(address);
            wallet.increaseBalance(amount);
            this.updateWalletVoteBalance(wallet);
        }
    }

    private async revertBlockFromForger(forgerWallet: Contracts.State.Wallet, block: Interfaces.IBlock) {
        const delegateAttribute = forgerWallet.getAttribute<Contracts.State.WalletDelegateAttributes>("delegate");
        const donations: Utils.BigNumber = Object.values(block.data.donations!).reduce(
            (curr, prev) => prev.plus(curr),
            Utils.BigNumber.ZERO,
        );

        delegateAttribute.producedBlocks--;
        delegateAttribute.burnedFees = delegateAttribute.burnedFees.minus(block.data.burnedFee!);
        delegateAttribute.forgedFees = delegateAttribute.forgedFees.minus(block.data.totalFee);
        delegateAttribute.forgedRewards = delegateAttribute.forgedRewards.minus(block.data.reward);
        delegateAttribute.donations = delegateAttribute.donations.minus(donations);

        const { results } = await this.blockHistoryService.listByCriteria(
            { username: block.data.username, height: { to: block.data.height - 1 } },
            [{ property: "height", direction: "desc" }],
            { offset: 0, limit: 1 },
        );

        if (results[0] && results[0].id) {
            delegateAttribute.lastBlock = results[0].id;
        } else {
            delegateAttribute.lastBlock = undefined;
        }

        const balanceDecrease = block.data.reward
            .minus(donations)
            .plus(block.data.totalFee.minus(block.data.burnedFee!));

        forgerWallet.decreaseBalance(balanceDecrease);
        this.updateWalletVoteBalance(forgerWallet);

        for (const [address, amount] of Object.entries(block.data.donations!)) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(address);
            wallet.decreaseBalance(amount);
            this.updateWalletVoteBalance(wallet);
        }
    }

    private updateVoteBalances(
        sender: Contracts.State.Wallet,
        recipient: Contracts.State.Wallet,
        transaction: Interfaces.ITransactionData,
        lockSenderWallet: Contracts.State.Wallet,
        lockRecipientWallet: Contracts.State.Wallet,
    ): void {
        if (
            transaction.type === Enums.TransactionType.Core.Transfer &&
            transaction.typeGroup === Enums.TransactionTypeGroup.Core
        ) {
            AppUtils.assert.defined<Interfaces.ITransferItem[]>(transaction.asset?.transfers);

            for (const { recipientId } of transaction.asset.transfers) {
                const recipientWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(recipientId);
                this.updateWalletVoteBalance(recipientWallet);
            }
        }

        if (sender) {
            this.updateWalletVoteBalance(sender);
        }

        if (recipient) {
            this.updateWalletVoteBalance(recipient);
        }

        if (lockSenderWallet) {
            this.updateWalletVoteBalance(lockSenderWallet);
        }

        if (lockRecipientWallet) {
            this.updateWalletVoteBalance(lockRecipientWallet);
        }
    }

    private initGenesisForgerWallet(forgerPublicKey: string) {
        if (this.walletRepository.hasByPublicKey(forgerPublicKey)) {
            return;
        }

        const forgerAddress = Identities.Address.fromPublicKey(forgerPublicKey);
        const forgerWallet = this.walletRepository.createWallet(forgerAddress);
        forgerWallet.setPublicKey(forgerPublicKey);
        this.walletRepository.index(forgerWallet);
    }
}
