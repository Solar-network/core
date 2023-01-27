import { Identities, Interfaces, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

// todo: review the implementation
@Container.injectable()
export class BlockState implements Contracts.State.BlockState {
    @Container.inject(Container.Identifiers.BlockHistoryService)
    private readonly blockHistoryService!: Contracts.Shared.BlockHistoryService;

    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    private handlerRegistry!: Handlers.Registry;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly state!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.WalletRepository)
    private walletRepository!: Contracts.State.WalletRepository;

    public async applyBlock(
        block: Interfaces.IBlock,
        transactionProcessing: {
            index: number | undefined;
        },
    ): Promise<void> {
        let blockProducerWallet: Contracts.State.Wallet;

        if (block.data.height === 1) {
            this.initGenesisWallet(block.data.generatorPublicKey);
            blockProducerWallet = this.walletRepository.findByPublicKey(block.data.generatorPublicKey);
        } else {
            blockProducerWallet = this.walletRepository.findByUsername(block.data.username!);
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
            this.applyBlockToBlockProducer(blockProducerWallet, block);

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
        const blockProducerWallet = this.walletRepository.findByUsername(block.data.username!);

        const revertedTransactions: Interfaces.ITransaction[] = [];
        try {
            await this.revertBlockFromBlockProducer(blockProducerWallet, block);

            for (const transaction of block.transactions.slice().reverse()) {
                await this.revertTransaction(block.data.height, transaction);
                revertedTransactions.push(transaction);
            }
        } catch (error) {
            for (const transaction of revertedTransactions.reverse()) {
                await this.applyTransaction(block.data.height, transaction);
            }
            throw error;
        }
    }

    public async applyTransaction(height: number, transaction: Interfaces.ITransaction): Promise<void> {
        transaction.setBurnedFee(height);

        const transactionHandler = await this.handlerRegistry.getActivatedHandlerForTransaction(transaction);

        await transactionHandler.apply(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        let recipientWallet: Contracts.State.Wallet | undefined;
        if (transaction.data.recipientId) {
            AppUtils.assert.defined<string>(transaction.data.recipientId);

            recipientWallet = this.walletRepository.findByAddress(transaction.data.recipientId);
        }

        this.updateVoteBalances(senderWallet, recipientWallet!, transaction.data);
    }

    public async revertTransaction(height: number, transaction: Interfaces.ITransaction): Promise<void> {
        transaction.setBurnedFee(height);

        const { data } = transaction;

        const transactionHandler = await this.handlerRegistry.getActivatedHandlerForTransaction(transaction);

        AppUtils.assert.defined<string>(data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(data.senderId);

        let recipientWallet: Contracts.State.Wallet | undefined;
        if (transaction.data.recipientId) {
            AppUtils.assert.defined<string>(transaction.data.recipientId);

            recipientWallet = this.walletRepository.findByAddress(transaction.data.recipientId);
        }

        await transactionHandler.revert(transaction);

        this.updateVoteBalances(senderWallet, recipientWallet!, data);
    }

    public updateWalletVoteBalance(wallet: Contracts.State.Wallet): void {
        AppUtils.decreaseVoteBalances(wallet, { walletRepository: this.walletRepository });
        wallet.updateVoteBalances();
        AppUtils.increaseVoteBalances(wallet, { walletRepository: this.walletRepository });
    }

    private applyBlockToBlockProducer(blockProducerWallet: Contracts.State.Wallet, block: Interfaces.IBlock) {
        const blockProducerAttribute =
            blockProducerWallet.getAttribute<Contracts.State.WalletBlockProducerAttributes>("blockProducer");
        const donations: Utils.BigNumber = Object.values(block.data.donations!).reduce(
            (curr, prev) => prev.plus(curr),
            Utils.BigNumber.ZERO,
        );

        blockProducerAttribute.producedBlocks++;
        blockProducerAttribute.burnedFees = blockProducerAttribute.burnedFees.plus(block.data.totalFeeBurned!);
        blockProducerAttribute.fees = blockProducerAttribute.fees.plus(block.data.totalFee);
        blockProducerAttribute.rewards = blockProducerAttribute.rewards.plus(block.data.reward);
        blockProducerAttribute.donations = blockProducerAttribute.donations.plus(donations);
        blockProducerAttribute.lastBlock = block.getHeader(true);

        const balanceIncrease = block.data.reward
            .minus(donations)
            .plus(block.data.totalFee.minus(block.data.totalFeeBurned!));

        blockProducerWallet.increaseBalance(balanceIncrease);
        this.updateWalletVoteBalance(blockProducerWallet);

        for (const [address, amount] of Object.entries(block.data.donations!)) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(address);
            wallet.increaseBalance(amount);
            this.updateWalletVoteBalance(wallet);
        }
    }

    private async revertBlockFromBlockProducer(blockProducerWallet: Contracts.State.Wallet, block: Interfaces.IBlock) {
        const blockProducerAttribute =
            blockProducerWallet.getAttribute<Contracts.State.WalletBlockProducerAttributes>("blockProducer");
        const donations: Utils.BigNumber = Object.values(block.data.donations!).reduce(
            (curr, prev) => prev.plus(curr),
            Utils.BigNumber.ZERO,
        );

        blockProducerAttribute.producedBlocks--;
        blockProducerAttribute.burnedFees = blockProducerAttribute.burnedFees.minus(block.data.totalFeeBurned!);
        blockProducerAttribute.fees = blockProducerAttribute.fees.minus(block.data.totalFee);
        blockProducerAttribute.rewards = blockProducerAttribute.rewards.minus(block.data.reward);
        blockProducerAttribute.donations = blockProducerAttribute.donations.minus(donations);

        const { results } = await this.blockHistoryService.listByCriteria(
            { username: block.data.username, height: { to: block.data.height - 1 } },
            [{ property: "height", direction: "desc" }],
            { offset: 0, limit: 1 },
            false,
        );

        if (results[0]) {
            blockProducerAttribute.lastBlock = results[0];
        } else {
            blockProducerAttribute.lastBlock = undefined;
        }

        const balanceDecrease = block.data.reward
            .minus(donations)
            .plus(block.data.totalFee.minus(block.data.totalFeeBurned!));

        blockProducerWallet.decreaseBalance(balanceDecrease);
        this.updateWalletVoteBalance(blockProducerWallet);

        for (const [address, amount] of Object.entries(block.data.donations!)) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(address);
            wallet.decreaseBalance(amount);
            this.updateWalletVoteBalance(wallet);
        }
    }

    private updateVoteBalances(
        sender: Contracts.State.Wallet,
        recipient: Contracts.State.Wallet,
        transactionData: Interfaces.ITransactionData,
    ): void {
        if (transactionData.type === "transfer") {
            AppUtils.assert.defined<Interfaces.ITransferRecipient[]>(transactionData.asset?.recipients);

            for (const { recipientId } of transactionData.asset.recipients) {
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
    }

    private initGenesisWallet(publicKey: string) {
        if (this.walletRepository.hasByPublicKey(publicKey)) {
            return;
        }

        const address = Identities.Address.fromPublicKey(publicKey);
        const wallet = this.walletRepository.createWallet(address);
        wallet.setPublicKey(publicKey, "primary");
        this.walletRepository.index(wallet);
    }
}
