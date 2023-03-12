import { Crypto, Interfaces, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@solar-network/kernel";

import { BlockProducerSignatureError, WalletHasNoUsernameError, WalletIsAlreadyBlockProducerError } from "../errors";
import { RegistrationTransactionHandler } from "./registration";
import { TransactionHandler, TransactionHandlerConstructor } from "./transaction";

@Container.injectable()
export class UpgradeTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public static walletAttributes(): ReadonlyArray<string> {
        return [
            "blockProducer.burnedFees",
            "blockProducer.donations",
            "blockProducer.failures",
            "blockProducer.fees",
            "blockProducer.lastBlock",
            "blockProducer.producedBlocks",
            "blockProducer.publicKey",
            "blockProducer.rank",
            "blockProducer.reliability",
            "blockProducer.rewards",
            "blockProducer.round",
            "blockProducer.total",
            "blockProducer.version",
            "blockProducer.voteBalance",
            "blockProducer.voters",
            "blockProducer",
            "hidden",
            "hidden.upgradeRound",
        ];
    }

    public static emitBlockProducerRegistrationEvent(
        events: Contracts.Kernel.EventDispatcher,
        transactionData: Interfaces.ITransactionData,
        username: string | undefined,
    ) {
        events.dispatch(AppEnums.BlockProducerEvent.Upgraded, {
            ...transactionData,
            username,
        });
    }

    public static forgetBlockProducerAttributes(
        wallet: Contracts.State.Wallet,
        transactionData: Interfaces.ITransactionData,
    ) {
        wallet.forgetAttribute("blockProducer");
        wallet.forgetAttribute("hidden.upgradeRound");
    }

    public static setBlockProducerAttributes(
        wallet: Contracts.State.Wallet,
        transactionData: Interfaces.ITransactionData,
    ) {
        wallet.setAttribute<Contracts.State.WalletBlockProducerAttributes>("blockProducer", {
            burnedFees: Utils.BigNumber.ZERO,
            donations: Utils.BigNumber.ZERO,
            fees: Utils.BigNumber.ZERO,
            producedBlocks: 0,
            publicKey: transactionData.asset?.blockProducer?.publicKey,
            rank: undefined,
            rewards: Utils.BigNumber.ZERO,
            voteBalance: Utils.BigNumber.ZERO,
            voters: 0,
        });

        const { round } = AppUtils.roundCalculator.calculateRound(transactionData.blockHeight!);
        wallet.setAttribute("hidden.upgradeRound", round);
    }

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [RegistrationTransactionHandler];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return UpgradeTransactionHandler.walletAttributes();
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.UpgradeTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            type: this.getConstructor().key,
        };

        for await (const transaction of this.transactionHistoryService.fetchByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            this.performWalletInitialisation(transaction, wallet);

            UpgradeTransactionHandler.setBlockProducerAttributes(wallet, transaction);

            this.walletRepository.index(wallet);
        }

        const producedBlocks = await this.blockRepository.getBlockProducerStatistics();
        const lastProducedBlocks = await this.blockRepository.getLastProducedBlocks();

        for (const block of producedBlocks) {
            if (!block.username) {
                continue;
            }

            const wallet: Contracts.State.Wallet = this.walletRepository.findByUsername(block.username);
            const blockProducer: Contracts.State.WalletBlockProducerAttributes = wallet.getAttribute("blockProducer");
            blockProducer.burnedFees = blockProducer.fees.plus(block.totalFeesBurned);
            blockProducer.fees = blockProducer.fees.plus(block.totalFees);
            blockProducer.rewards = blockProducer.rewards.plus(block.totalRewards);
            blockProducer.donations = blockProducer.donations.plus(block.donations || Utils.BigNumber.ZERO);
            blockProducer.producedBlocks += +block.totalProduced;
        }

        for (const block of lastProducedBlocks) {
            if (!block.username) {
                continue;
            }

            const wallet: Contracts.State.Wallet = this.walletRepository.findByUsername(block.username);
            block.donations = Utils.calculateDonations(block.height, block.reward);
            wallet.setAttribute("blockProducer.lastBlock", block);
        }
    }
    public async isActivated(transaction?: Interfaces.ITransaction): Promise<boolean> {
        return true;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        if (!wallet.hasAttribute("username")) {
            throw new WalletHasNoUsernameError();
        }

        if (wallet.hasAttribute("blockProducer")) {
            throw new WalletIsAlreadyBlockProducerError(wallet.getAttribute("username"));
        }

        if (
            !(await Crypto.Hash.verifyBLS(
                Buffer.from(wallet.getPublicKey("primary")!, "hex"),
                transaction.data.asset!.blockProducer!.signature,
                transaction.data.asset!.blockProducer!.publicKey,
            ))
        ) {
            throw new BlockProducerSignatureError();
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public emitEvents(transaction: Interfaces.ITransaction): void {
        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);
        const username = senderWallet.getAttribute("username");

        UpgradeTransactionHandler.emitBlockProducerRegistrationEvent(this.events, transaction.data, username);
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const hasSender: boolean = this.poolQuery
            .getAllBySender(transaction.data.senderId)
            .whereKind(transaction)
            .has();

        if (hasSender) {
            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);
            throw new Contracts.Pool.PoolError(
                `Upgrade for '${wallet.getAttribute("username")}' already in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);

        UpgradeTransactionHandler.setBlockProducerAttributes(senderWallet, transaction.data);

        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet = this.walletRepository.findByAddress(transaction.data.senderId);

        UpgradeTransactionHandler.forgetBlockProducerAttributes(senderWallet, transaction.data);

        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}
