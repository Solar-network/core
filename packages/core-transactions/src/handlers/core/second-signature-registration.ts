import { Container, Contracts, Utils } from "@solar-network/core-kernel";
import { Interfaces, Transactions } from "@solar-network/crypto";

import { NotSupportedForMultiSignatureWalletError, SecondSignatureAlreadyRegisteredError } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

@Container.injectable()
export class SecondSignatureRegistrationTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    @Container.inject(Container.Identifiers.TransactionPoolQuery)
    private readonly poolQuery!: Contracts.TransactionPool.Query;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["secondPublicKey"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.SecondSignatureRegistrationTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            typeGroup: this.getConstructor().typeGroup,
            type: this.getConstructor().type,
        };

        for await (const transaction of this.transactionHistoryService.streamByCriteria(criteria)) {
            Utils.assert.defined<string>(transaction.senderPublicKey);
            Utils.assert.defined<string>(transaction.asset?.signature?.publicKey);

            const wallet = this.walletRepository.findByPublicKey(transaction.senderPublicKey);
            wallet.setAttribute("secondPublicKey", transaction.asset.signature.publicKey);
        }
    }

    public async isActivated(): Promise<boolean> {
        return true;
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        if (wallet.hasSecondSignature()) {
            throw new SecondSignatureAlreadyRegisteredError();
        }

        Utils.assert.defined<string>(transaction.data.senderPublicKey);
        Utils.assert.defined<string>(transaction.data.asset?.signature?.publicKey);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            transaction.data.senderPublicKey,
        );

        if (senderWallet.hasMultiSignature()) {
            throw new NotSupportedForMultiSignatureWalletError();
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const hasSender: boolean = this.poolQuery
            .getAllBySender(transaction.data.senderPublicKey)
            .whereKind(transaction)
            .has();

        if (hasSender) {
            throw new Contracts.TransactionPool.PoolError(
                `Sender ${transaction.data.senderPublicKey} already has a second signature registration transaction in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByPublicKey(
            transaction.data.senderPublicKey,
        );

        Utils.assert.defined<string>(transaction.data.asset?.signature?.publicKey);

        senderWallet.setAttribute("secondPublicKey", transaction.data.asset.signature.publicKey);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        Utils.assert.defined<string>(transaction.data.senderPublicKey);

        this.walletRepository.findByPublicKey(transaction.data.senderPublicKey).forgetAttribute("secondPublicKey");
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}
