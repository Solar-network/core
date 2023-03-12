import { Interfaces, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { IpfsHashAlreadyExists } from "../errors";
import { TransactionHandler, TransactionHandlerConstructor } from "./transaction";

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
        return Transactions.IpfsTransaction;
    }

    public async bootstrap(): Promise<void> {
        const criteria = {
            type: this.getConstructor().key,
        };

        for await (const transaction of this.transactionHistoryService.fetchByCriteria(criteria)) {
            AppUtils.assert.defined<string>(transaction.senderId);
            AppUtils.assert.defined<string>(transaction.asset?.ipfs?.hash);

            const wallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.senderId);
            this.performWalletInitialisation(transaction, wallet);

            if (!wallet.hasAttribute("ipfs")) {
                wallet.setAttribute("ipfs", { hashes: {} });
            }

            const ipfsHashes: Contracts.State.WalletIpfsAttributes = wallet.getAttribute("ipfs.hashes");
            ipfsHashes[transaction.asset.ipfs.hash] = true;
            this.walletRepository.index(wallet);
        }
    }

    public async isActivated(transaction?: Interfaces.ITransaction): Promise<boolean> {
        return true;
    }

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        AppUtils.assert.defined<string>(transaction.data.asset?.ipfs);

        const hasIPFS: boolean = this.poolQuery
            .getAll()
            .whereKind(transaction)
            .wherePredicate((t) => t.data.asset!.ipfs!.hash === transaction.data.asset!.ipfs!.hash)
            .has();

        if (hasIPFS) {
            throw new Contracts.Pool.PoolError(
                `IPFS transaction with IPFS address '${transaction.data.asset.ipfs.hash}' already in the pool`,
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

        AppUtils.assert.defined<string>(transaction.data.asset?.ipfs?.hash);

        if (this.walletRepository.hasByIndex(Contracts.State.WalletIndexes.Ipfs, transaction.data.asset.ipfs.hash)) {
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

        AppUtils.assert.defined<string>(transaction.data.asset?.ipfs?.hash);

        senderWallet.getAttribute("ipfs.hashes", {})[transaction.data.asset.ipfs.hash] = true;

        this.walletRepository.index(senderWallet);
    }

    public async revertForSender(transaction: Interfaces.ITransaction): Promise<void> {
        await super.revertForSender(transaction);

        AppUtils.assert.defined<string>(transaction.data.senderId);

        const senderWallet: Contracts.State.Wallet = this.walletRepository.findByAddress(transaction.data.senderId);

        AppUtils.assert.defined<Interfaces.ITransactionAsset>(transaction.data.asset?.ipfs?.hash);

        const ipfsHashes = senderWallet.getAttribute("ipfs.hashes");
        delete ipfsHashes[transaction.data.asset.ipfs.hash];

        if (Object.keys(ipfsHashes).length === 0) {
            senderWallet.forgetAttribute("ipfs");
        }

        this.walletRepository.index(senderWallet);
    }

    public async applyToRecipient(transaction: Interfaces.ITransaction): Promise<void> {}

    public async revertForRecipient(transaction: Interfaces.ITransaction): Promise<void> {}
}
