import { Contracts } from "@solar-network/kernel";

const isIndexable = (wallet: Contracts.State.Wallet): boolean => {
    return (
        wallet.countAttributes() > 1 ||
        wallet.hasPublicKeyByType("primary") ||
        !wallet.getBalance().isZero() ||
        !wallet.getNonce().isZero()
    );
};

const shouldBeIndexed = (wallet: Contracts.State.Wallet, blockchainWallet?: Contracts.State.Wallet): boolean => {
    const blockchainWalletIsIndexable = blockchainWallet && isIndexable(blockchainWallet);
    const walletIsIndexable = isIndexable(wallet);

    if (!walletIsIndexable && blockchainWalletIsIndexable) {
        return true;
    }

    return walletIsIndexable;
};

export const addressesIndexer = (
    index: Contracts.State.WalletIndex,
    wallet: Contracts.State.Wallet,
    blockchainWallet?: Contracts.State.Wallet,
): void => {
    if (wallet.getAddress() && shouldBeIndexed(wallet, blockchainWallet)) {
        index.set(wallet.getAddress(), wallet);
    }
};

export const publicKeysIndexer = (
    index: Contracts.State.WalletIndex,
    wallet: Contracts.State.Wallet,
    blockchainWallet?: Contracts.State.Wallet,
): void => {
    if (wallet.getPublicKey("primary") && shouldBeIndexed(wallet, blockchainWallet)) {
        index.set(wallet.getPublicKey("primary"), wallet);
    }
};

export const usernamesIndexer = (
    index: Contracts.State.WalletIndex,
    wallet: Contracts.State.Wallet,
    blockchainWallet?: Contracts.State.Wallet,
): void => {
    if (wallet.isDelegate() && shouldBeIndexed(wallet, blockchainWallet)) {
        index.set(wallet.getAttribute("delegate.username"), wallet);
    }
};

export const resignationsIndexer = (
    index: Contracts.State.WalletIndex,
    wallet: Contracts.State.Wallet,
    blockchainWallet?: Contracts.State.Wallet,
): void => {
    if (wallet.isDelegate() && wallet.hasAttribute("delegate.resigned") && shouldBeIndexed(wallet, blockchainWallet)) {
        index.set(wallet.getAttribute("delegate.username"), wallet);
    }
};

export const locksIndexer = (
    index: Contracts.State.WalletIndex,
    wallet: Contracts.State.Wallet,
    blockchainWallet?: Contracts.State.Wallet,
): void => {
    if (wallet.hasAttribute("htlc.locks") && shouldBeIndexed(wallet, blockchainWallet)) {
        const locks: object = wallet.getAttribute("htlc.locks");

        for (const lockId of Object.keys(locks)) {
            index.set(lockId, wallet);
        }
    }
};

export const ipfsIndexer = (
    index: Contracts.State.WalletIndex,
    wallet: Contracts.State.Wallet,
    blockchainWallet?: Contracts.State.Wallet,
): void => {
    if (wallet.hasAttribute("ipfs.hashes") && shouldBeIndexed(wallet, blockchainWallet)) {
        const hashes: object = wallet.getAttribute("ipfs.hashes");

        for (const hash of Object.keys(hashes)) {
            index.set(hash, wallet);
        }
    }
};
