import { Contracts } from "@solar-network/kernel";

const isIndexable = (wallet: Contracts.State.Wallet): boolean => {
    return (
        wallet.countAttributes() > 1 ||
        wallet.hasMultiSignature() ||
        wallet.hasPublicKey() ||
        !wallet.getBalance().isZero() ||
        !wallet.getNonce().isZero()
    );
};

export const addressesIndexer = (index: Contracts.State.WalletIndex, wallet: Contracts.State.Wallet): void => {
    if (wallet.getAddress() && isIndexable(wallet)) {
        index.set(wallet.getAddress(), wallet);
    }
};

export const publicKeysIndexer = (index: Contracts.State.WalletIndex, wallet: Contracts.State.Wallet): void => {
    if (wallet.getPublicKey() && isIndexable(wallet)) {
        index.set(wallet.getPublicKey()!, wallet);
    }
};

export const usernamesIndexer = (index: Contracts.State.WalletIndex, wallet: Contracts.State.Wallet): void => {
    if (wallet.isDelegate() && isIndexable(wallet)) {
        index.set(wallet.getAttribute("delegate.username"), wallet);
    }
};

export const resignationsIndexer = (index: Contracts.State.WalletIndex, wallet: Contracts.State.Wallet): void => {
    if (wallet.isDelegate() && wallet.hasAttribute("delegate.resigned") && isIndexable(wallet)) {
        index.set(wallet.getAttribute("delegate.username"), wallet);
    }
};

export const locksIndexer = (index: Contracts.State.WalletIndex, wallet: Contracts.State.Wallet): void => {
    if (wallet.hasAttribute("htlc.locks") && isIndexable(wallet)) {
        const locks: object = wallet.getAttribute("htlc.locks");

        for (const lockId of Object.keys(locks)) {
            index.set(lockId, wallet);
        }
    }
};

export const ipfsIndexer = (index: Contracts.State.WalletIndex, wallet: Contracts.State.Wallet): void => {
    if (wallet.hasAttribute("ipfs.hashes") && isIndexable(wallet)) {
        const hashes: object = wallet.getAttribute("ipfs.hashes");

        for (const hash of Object.keys(hashes)) {
            index.set(hash, wallet);
        }
    }
};
