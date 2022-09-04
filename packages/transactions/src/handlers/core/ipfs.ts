import { Enums, Interfaces, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { IpfsHashAlreadyExists } from "../../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "../transaction";

@Container.injectable()
export class IpfsTransactionHandler extends TransactionHandler {
    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public dependencies(): ReadonlyArray<TransactionHandlerConstructor> {
        return [];
    }

    public walletAttributes(): ReadonlyArray<string> {
        return ["ipfs", "ipfs.hashes"];
    }

    public getConstructor(): Transactions.TransactionConstructor {
        return Transactions.Core.IpfsTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            typeGroup: this.getConstructor().typeGroup,
            type: this.getConstructor().type,
        };

        for await (const transaction of this.transactionHistoryService.streamByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);
            AppUtils.assert.defined<string>(transaction.asset?.ipfs);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            if (
                transaction.headerType === Enums.TransactionHeaderType.Standard &&
                wallet.getPublicKey() === undefined
            ) {
                wallet.setPublicKey(transaction.senderPublicKey);
            }

            if (!wallet.hasAttribute("ipfs")) {
                wallet.setAttribute("ipfs", { hashes: {} });
            }

            const ipfsHashes: Contracts.State.WalletIpfsAttributes = wallet.getAttribute("ipfs.hashes");
            ipfsHashes[transaction.asset.ipfs] = true;
            this.walletRepository.index(wallet);
        }
    }

    public async isActivated(): Promise<boolean> {
        return true;
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.asset?.ipfs);

        const hasIPFS: boolean = this.poolQuery
            .getAll()
            .whereKind(transaction)
            .wherePredicate((t) => t.data.asset!.ipfs === transaction.data.asset!.ipfs)
            .has();

        if (hasIPFS) {
            throw new Contracts.Pool.PoolError(
                `IPFS transaction with IPFS address '${transaction.data.asset.ipfs}' already in the pool`,
                "ERR_PENDING",
            );
        }
    }

    public async throwIfCannotBeApplied(
        transaction: Interfaces.ITransaction,
        wallet: Contracts.State.Wallet,
    ): Promise<void> {
        if (Utils.isException(transaction.data)) {
            return;
        }

        AppUtils.assert.defined<Interfaces.IHtlcLockAsset>(transaction.data.asset?.ipfs);

        if (this.walletRepository.hasByIndex(Contracts.State.WalletIndexes.Ipfs, transaction.data.asset.ipfs)) {
            throw new IpfsHashAlreadyExists();
        }

        return super.throwIfCannotBeApplied(transaction, wallet);
    }

    public async applyToSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.applyToSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        if (!senderWallet.hasAttribute("ipfs")) {
            senderWallet.setAttribute("ipfs", { hashes: {} });
        }

        AppUtils.assert.defined<string>(transaction.data.asset?.ipfs);

        senderWallet.getAttribute("ipfs.hashes", {})[transaction.data.asset.ipfs] = true;

        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        AppUtils.assert.defined<Interfaces.ITransactionAsset>(transaction.data.asset?.ipfs);

        const ipfsHashes = senderWallet.getAttribute("ipfs.hashes");
        delete ipfsHashes[transaction.data.asset.ipfs];

        if (Object.keys(ipfsHashes).length === 0) {
            senderWallet.forgetAttribute("ipfs");
        }

        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}
