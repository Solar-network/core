import * as EthereumTx from "@ethereumjs/tx";
import { BlockProcessor, BlockProcessorResult } from "@solar-network/blockchain/dist/processor";
import { Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Providers, Services, Utils as AppUtils } from "@solar-network/kernel";
import { TransactionValidator } from "@solar-network/state/dist/transaction-validator";
import { Handlers } from "@solar-network/transactions";
import { ColdWalletError } from "@solar-network/transactions/dist/errors";
import assert from "assert";
import delay from "delay";
import InputDataDecoder from "ethereum-input-data-decoder";
import Web3 from "web3";
import { HttpProvider } from "web3-providers-http";

import { ApplyTransactionAction } from "./apply";
import {
    ApiCommunicationError,
    InvalidSignatureError,
    MemoIncorrectError,
    TransactionAlreadyCompletedError,
    TransactionAlreadySubmittedError,
    TransactionDoesNotExistError,
    TransactionHasWrongAmountError,
    TransactionHasWrongRecipientError,
    TransactionIdInvalidError,
    TransactionNotValidError,
    TransactionNotYetConfirmedError,
    TransactionTypeNotPermittedError,
    UnknownSwapNetworkError,
    WrongChainError,
    WrongContractError,
    WrongTokenError,
} from "./errors";
import { DuplicateSwapTransactionsHandler } from "./handler";
import { Peers } from "./interfaces";

@Container.injectable()
export class SXPSwap {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/sxp-swap")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.LogService)
    private readonly log!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.PoolQuery)
    private readonly poolQuery!: Contracts.Pool.Query;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    public register(): void {
        const self = this;

        const supportedNetworks = ["bsc", "eth"];

        const peersAddresses = {
            bsc: this.configuration.get("peers.bsc") as string[],
            eth: this.configuration.get("peers.eth") as string[],
        };

        const swapWalletPublicKey = this.configuration.get("swapWalletPublicKey") as string;

        const chainId = {
            bsc: this.configuration.get("chainId.bsc") as string,
            eth: this.configuration.get("chainId.eth") as string,
        };

        const contractAbis = {
            bsc: JSON.parse(this.configuration.get("contractAbis.bsc") as string),
            eth: JSON.parse(this.configuration.get("contractAbis.eth") as string),
        };

        const contractDecimals = {
            bsc: this.configuration.get("contractDecimals.bsc") as Number,
            eth: this.configuration.get("contractDecimals.eth") as Number,
        };

        const minimumConfirmations = {
            bsc: this.configuration.get("minimumConfirmations.bsc") as Number,
            eth: this.configuration.get("minimumConfirmations.eth") as Number,
        };

        const sxpTokenContracts = {
            bsc: this.configuration.get("sxpTokenContracts.bsc") as string,
            eth: this.configuration.get("sxpTokenContracts.eth") as string,
        };

        const swapContractAddresses = {
            bsc: this.configuration.get("swapContractAddresses.bsc") as string,
            eth: this.configuration.get("swapContractAddresses.eth") as string,
        };

        const peers: Peers = {
            bsc: [],
            eth: [],
        };

        peers.bsc = peersAddresses.bsc.map((o) => new Web3(o));
        peers.eth = peersAddresses.eth.map((o) => new Web3(o));

        (BlockProcessor.prototype as any)._process = BlockProcessor.prototype.process;
        BlockProcessor.prototype.process = function (block: Interfaces.IBlock): Promise<BlockProcessorResult> {
            const swapTransactions = block.transactions.filter(
                (transaction) => transaction.data.senderPublicKey === swapWalletPublicKey,
            );
            const duplicateSwapMemos = new Set(
                swapTransactions
                    .map((transaction) => transaction.data.memo)
                    .filter((memo, index, array) => array.indexOf(memo) !== index),
            );

            if (duplicateSwapMemos.size > 0) {
                for (const duplicateSwapMemo of duplicateSwapMemos) {
                    const memoData: string[] =
                        typeof duplicateSwapMemo === "string" ? duplicateSwapMemo.split(":") : [];
                    if (memoData.length === 2) {
                        const [network, transactionId] = memoData;
                        swapTransactions
                            .filter((transaction) => transaction.data.memo === duplicateSwapMemo)
                            .forEach((transaction) => {
                                self.log.warning(
                                    `Attempted duplication of swap transaction ${transactionId} (${network}) => ${transaction.data.id} (native coin) rejected :gun:`,
                                );
                            });
                    }
                }

                self.log.warning(
                    `Block ${block.data.height.toLocaleString()} disregarded, because it contains duplicated swap transactions :scroll:`,
                );
                return (this as any).app.resolve(DuplicateSwapTransactionsHandler).execute();
            }

            return (this as any)._process(block);
        };

        Handlers.TransactionHandler.prototype.apply = async function (
            transaction: Interfaces.ITransaction,
            status?: string,
        ): Promise<void> {
            try {
                await (this as any).applyToSender(transaction, status);
                await this.applyToRecipient(transaction);
            } finally {
                await (this as any).index(transaction);
            }
        };

        Handlers.TransactionHandler.prototype.applyToSender = async function (
            transaction: Interfaces.ITransaction,
            status?: string,
        ): Promise<void> {
            AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

            const data: Interfaces.ITransactionData = transaction.data;

            if (Utils.isException(data)) {
                self.log.warning(`Transaction forcibly applied as an exception: ${transaction.id}`);
            }

            const sender: Contracts.State.Wallet = (this as any).walletRepository.findByPublicKey(
                transaction.data.senderPublicKey,
            );

            await (this as any).throwIfCannotBeApplied(transaction, sender, status);

            (this as any).verifyTransactionNonceApply(sender, transaction);

            AppUtils.assert.defined<Utils.BigNumber>(data.nonce);

            sender.setNonce(data.nonce);

            const newBalance: Utils.BigNumber = sender
                .getBalance()
                .minus(data.amount || Utils.BigNumber.ZERO)
                .minus(data.fee);

            assert(Utils.isException(transaction.data) || !newBalance.isNegative());

            sender.setBalance(newBalance);
        };

        Handlers.TransactionHandler.prototype.throwIfCannotBeApplied = async function (
            transaction: Interfaces.ITransaction,
            sender: Contracts.State.Wallet,
        ): Promise<void> {
            const senderWallet: Contracts.State.Wallet = (this as any).walletRepository.findByAddress(
                sender.getAddress(),
            );

            AppUtils.assert.defined<string>(sender.getPublicKey());

            const transactionData: Interfaces.ITransactionData = transaction.data;
            if (
                transactionData.senderPublicKey === swapWalletPublicKey &&
                (transactionData.typeGroup !== 1 || transactionData.type !== 0)
            ) {
                throw new TransactionTypeNotPermittedError();
            }

            if (
                !(this as any).walletRepository.hasByPublicKey(sender.getPublicKey()!) &&
                senderWallet.getBalance().isZero()
            ) {
                throw new ColdWalletError();
            }

            const milestone = Managers.configManager.getMilestone();
            (this as any).enforceMinimumFee(transaction, milestone.dynamicFees);

            return (this as any).performGenericWalletChecks(transaction, sender);
        };

        (Handlers.Core.LegacyTransferTransactionHandler as any).prototype._throwIfCannotBeApplied =
            Handlers.Core.LegacyTransferTransactionHandler.prototype.throwIfCannotBeApplied;
        Handlers.Core.LegacyTransferTransactionHandler.prototype.throwIfCannotBeApplied = async function (
            transaction: Interfaces.ITransaction,
            sender: Contracts.State.Wallet,
            status?: string,
        ): Promise<void> {
            await (this as any)._throwIfCannotBeApplied(transaction, sender);
            AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

            const transactionData: Interfaces.ITransactionData = transaction.data;
            if (transactionData.senderPublicKey === swapWalletPublicKey) {
                const memoData: string[] =
                    typeof transactionData.memo === "string" ? transactionData.memo.split(":") : [];
                if (memoData.length !== 2) {
                    throw new MemoIncorrectError();
                }

                const [network, transactionId] = memoData;

                try {
                    if (!supportedNetworks.includes(network)) {
                        throw new UnknownSwapNetworkError(network, supportedNetworks);
                    }

                    if (!/^0x[0-9a-f]{64}$/.test(transactionId)) {
                        throw new TransactionIdInvalidError();
                    }

                    const results = await new Promise<Record<string, any>>((resolve) => {
                        let isResolved = false;
                        let rejections = 0;

                        const resolvesFirst = (
                            response?:
                                | { api: string | undefined; height: unknown; txInfo: unknown; txReceipt: unknown }
                                | undefined,
                        ) => {
                            if (!isResolved) {
                                isResolved = true;
                                return resolve(response ?? {});
                            }
                        };

                        Promise.all(
                            peers[network].map(async (peer: Web3) => {
                                try {
                                    const api = peer.eth.currentProvider
                                        ? (peer.eth.currentProvider as HttpProvider).host
                                        : undefined;
                                    const height = await self.getBlockNumber(peer);
                                    const txInfo = await self.getTransaction(transactionId, peer);
                                    const txReceipt = await self.getReceipt(transactionId, peer);

                                    if (!isResolved) {
                                        resolvesFirst({ api, height, txInfo, txReceipt });
                                    }
                                } catch {
                                    rejections++;
                                    if (rejections === peers[network].length) {
                                        resolvesFirst();
                                    }
                                }
                            }),
                        );

                        delay(2000).finally(() => resolvesFirst());
                    });

                    const { api, height, txInfo, txReceipt } = results;

                    if (!api || !height) {
                        throw new ApiCommunicationError(network);
                    }

                    self.log.info(
                        `Queried ${network} server ${api} for status of swap transaction ${transactionId} :mag:`,
                    );

                    if (!txInfo || !txReceipt) {
                        throw new TransactionDoesNotExistError();
                    }

                    if (!txReceipt.to || !txInfo.to) {
                        throw new TransactionNotValidError();
                    }

                    if (swapContractAddresses[network] !== txInfo.to.toLowerCase()) {
                        throw new WrongContractError();
                    }

                    if (txInfo.chainId && Number(txInfo.chainId) !== Number(chainId[network])) {
                        throw new WrongChainError(txInfo.chainId, chainId[network]);
                    }

                    if (
                        !txReceipt.blockNumber ||
                        !txInfo.blockNumber ||
                        (txReceipt.status !== 1 && txReceipt.status !== true)
                    ) {
                        throw new TransactionNotYetConfirmedError();
                    }

                    const confirmations = height - txInfo.blockNumber;

                    if (confirmations < minimumConfirmations[network]) {
                        throw new TransactionNotYetConfirmedError();
                    }

                    const tokenContract = txReceipt.logs[0].address;

                    if (sxpTokenContracts[network] !== tokenContract.toLowerCase()) {
                        throw new WrongTokenError();
                    }

                    const decoder = new InputDataDecoder(contractAbis[network]);
                    const parameters = decoder.decodeData(txInfo.input);

                    let contractAmount = parameters.inputs[0].toString();
                    const networkContractDecimals = contractDecimals[network];

                    if (networkContractDecimals > 8) {
                        contractAmount = contractAmount.slice(0, 8 - networkContractDecimals);
                    } else if (networkContractDecimals < 8) {
                        contractAmount = contractAmount + "0".repeat(8 - networkContractDecimals);
                    }
                    const amount = Utils.BigNumber.make(contractAmount);

                    const sxpAddress = parameters.inputs[1];
                    const method = parameters.method;

                    if (method !== "swapSXP") {
                        throw new TransactionNotValidError();
                    }

                    if (!amount.isEqualTo(transactionData.amount)) {
                        throw new TransactionHasWrongAmountError(transactionData.amount, amount);
                    }

                    if (sxpAddress !== transactionData.recipientId) {
                        throw new TransactionHasWrongRecipientError(transactionData.recipientId!, sxpAddress);
                    }

                    const alreadyProcessedThisSwap = await self.transactionHistoryService.findOneByCriteria({
                        senderPublicKey: swapWalletPublicKey,
                        memo: transactionData.memo,
                    });

                    if (alreadyProcessedThisSwap !== undefined) {
                        throw new TransactionAlreadyCompletedError();
                    }

                    const transactionObject = EthereumTx.TransactionFactory.fromTxData({
                        nonce: txInfo.nonce,
                        gasPrice: +txInfo.gasPrice,
                        gasLimit: +txInfo.gas,
                        to: txInfo.to,
                        value: "0x" + txInfo.value,
                        data: txInfo.input,
                        v: txInfo.v,
                        r: txInfo.r,
                        s: txInfo.s,
                        type: txInfo.type,
                        chainId: txInfo.chainId,
                        accessList: txInfo.accessList,
                        maxPriorityFeePerGas: +txInfo.maxPriorityFeePerGas,
                        maxFeePerGas: +txInfo.maxFeePerGas,
                    });

                    if (transactionObject.getSenderAddress().toString() !== txInfo.from.toLowerCase()) {
                        throw new InvalidSignatureError();
                    }

                    switch (status) {
                        case "pool": {
                            self.log.info(
                                `Swap transaction ${transactionId} (${network}) => ${transactionData.id} (native coin) passed all checks to enter the transaction pool :crossed_fingers:`,
                            );
                            break;
                        }
                        case "validate": {
                            self.log.info(
                                `Swap transaction ${transactionId} (${network}) => ${transactionData.id} (native coin) ready to be forged :v:`,
                            );
                            break;
                        }
                        default: {
                            self.log.info(
                                `Swap transaction ${transactionId} (${network}) => ${transactionData.id} (native coin) approved and added to the blockchain :white_check_mark:`,
                            );
                        }
                    }
                } catch (error) {
                    self.log.warning(
                        `Swap transaction ${transactionId} (${network}) => ${transactionData.id} (native coin) rejected :x:`,
                    );
                    throw error;
                }
            }
        };

        (Handlers.Core.LegacyTransferTransactionHandler as any).prototype._throwIfCannotEnterPool =
            Handlers.Core.LegacyTransferTransactionHandler.prototype.throwIfCannotEnterPool;
        Handlers.Core.LegacyTransferTransactionHandler.prototype.throwIfCannotEnterPool = async function (
            transaction: Interfaces.ITransaction,
        ): Promise<void> {
            await (this as any)._throwIfCannotEnterPool(transaction);
            AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

            const transactionData: Interfaces.ITransactionData = transaction.data;
            if (transactionData.senderPublicKey === swapWalletPublicKey) {
                const memoData: string[] =
                    typeof transactionData.memo === "string" ? transactionData.memo.split(":") : [];
                if (memoData.length !== 2) {
                    throw new MemoIncorrectError();
                }

                const [network, transactionId] = memoData;

                const alreadyInPool: boolean = self.poolQuery
                    .getAllBySender(transactionData.senderId)
                    .wherePredicate((t) => t.data.memo === transactionData.memo)
                    .has();

                if (alreadyInPool) {
                    self.log.warning(
                        `Attempted duplication of swap transaction ${transactionId} (${network}) => ${transactionData.id} (native coin) rejected :gun:`,
                    );
                    throw new TransactionAlreadySubmittedError();
                }
            }
        };

        TransactionValidator.prototype.validate = async function (transaction: Interfaces.ITransaction): Promise<Interfaces.ITransaction> {
            const deserialised: Interfaces.ITransaction = Transactions.TransactionFactory.fromBytes(
                transaction.serialised,
            );
            assert.strictEqual(transaction.id, deserialised.id);
            const handler = await (this as any).handlerRegistry.getActivatedHandlerForData(deserialised.data);
            await handler.apply(deserialised, "validate");
            return deserialised;
        };

        this.app.get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService).unbind("applyTransaction");
        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("applyTransaction", new ApplyTransactionAction());
    }

    private async getBlockNumber(peer) {
        return new Promise(async (resolve, reject) => {
            try {
                const blockNumber = await peer.eth.getBlockNumber();
                if (!blockNumber) {
                    return reject();
                }
                return resolve(blockNumber);
            } catch (err) {
                return reject(err);
            }
        });
    }

    private async getTransaction(transactionId, peer) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = await peer.eth.getTransaction(transactionId);
                if (!transaction) {
                    return reject();
                }
                return resolve(transaction);
            } catch (err) {
                return reject(err);
            }
        });
    }

    private async getReceipt(transactionId, peer) {
        return new Promise(async (resolve, reject) => {
            try {
                const receipt = await peer.eth.getTransactionReceipt(transactionId);
                if (!receipt) {
                    return reject();
                }
                return resolve(receipt);
            } catch (err) {
                return reject(err);
            }
        });
    }
}
