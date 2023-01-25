import { Enums, Interfaces, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Enums as AppEnums, Utils as AppUtils } from "@solar-network/kernel";

import { WalletAlreadyHasUsernameError, WalletUsernameAlreadyRegisteredError } from "../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "./transaction";

@Container.injectable()
export class RegistrationTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return [
            "blockProducer.burnedFees", // Used by the API
            "blockProducer.donations", // Used by the API
            "blockProducer.failures", // Used by the API
            "blockProducer.fees", // Used by the API
            "blockProducer.lastBlock",
            "blockProducer.producedBlocks", // Used by the API
            "blockProducer.rank",
            "blockProducer.reliability", // Used by the API
            "blockProducer.rewards", // Used by the API
            "blockProducer.round",
            "blockProducer.total", // Used by the API
            "blockProducer.version", // Used by the API
            "blockProducer.voteBalance",
            "blockProducer.voters", // Used by the API
            "blockProducer",
            "username",
        ];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.RegistrationTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            type: this.getConstructor().key,
        };

        for await (const transaction of this.transactionHistoryService.fetchByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);
            AppUtils.assert.defined<string>(transaction.asset?.registration?.username);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            if (
                transaction.headerType === Enums.TransactionHeaderType.Standard &&
                wallet.getPublicKey("primary") === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey, "primary");
            }

            wallet.setAttribute<Contracts.State.WalletBlockProducerAttributes>("blockProducer", {
                voteBalance: Utils.BigNumber.ZERO,
                fees: Utils.BigNumber.ZERO,
                burnedFees: Utils.BigNumber.ZERO,
                rewards: Utils.BigNumber.ZERO,
                donations: Utils.BigNumber.ZERO,
                producedBlocks: 0,
                rank: undefined,
                voters: 0,
            });

            wallet.setAttribute("username", transaction.asset.registration.username);
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
        const { data }: Interfaces.ITransaction = transaction;

        AppUtils.assert.defined<string>(data.asset?.registration?.username);

        const username: string = data.asset.registration.username;

        if (wallet.hasAttribute("username")) {
            throw new WalletAlreadyHasUsernameError();
        }

        if (this.walletRepository.hasByUsername(username)) {
            throw new WalletUsernameAlreadyRegisteredError(username);
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public emitEvents(transaction: Interfaces.ITransaction): void {
        this.events.dispatch(AppEnums.BlockProducerEvent.Registered, {
            ...transaction.data,
            username: transaction.data.asset?.registration?.username,
        });

        this.events.dispatch(AppEnums.UsernameEvent.Registered, {
            ...transaction.data,
            username: transaction.data.asset?.registration?.username,
        });
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.senderId);

        const hasSender: boolean = this.poolQuery
            .getAllBySender(transaction.data.senderId)
            .whereKind(transaction)
            .has();

        if (hasSender) {
            throw new Contracts.Pool.PoolError(
                `${transaction.data.senderId} already has a registration transaction in the pool`,
                "ERR_PENDING",
            );
        }

        AppUtils.assert.defined<string>(transaction.data.asset?.registration?.username);
        const username: string = transaction.data.asset.registration.username;
        const hasUsername: boolean = this.poolQuery
            .getAll()
            .whereKind(transaction)
            .wherePredicate((t) => t.data.asset?.registration?.username === username)
            .has();

        if (hasUsername) {
            throw new Contracts.Pool.PoolError(`Registration for '${username}' already in the pool`, "ERR_PENDING");
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        AppUtils.assert.defined<string>(transaction.data.asset?.registration?.username);

        senderWallet.setAttribute<Contracts.State.WalletBlockProducerAttributes>("blockProducer", {
            voteBalance: Utils.BigNumber.ZERO,
            fees: Utils.BigNumber.ZERO,
            burnedFees: Utils.BigNumber.ZERO,
            rewards: Utils.BigNumber.ZERO,
            donations: Utils.BigNumber.ZERO,
            producedBlocks: 0,
            round: 0,
            voters: 0,
        });

        senderWallet.setAttribute("username", transaction.data.asset.registration.username);
        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        senderWallet.forgetAttribute("blockProducer");
        senderWallet.forgetAttribute("username");

        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}
