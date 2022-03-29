import { BlockProcessor, BlockProcessorResult } from "@solar-network/core-blockchain/dist/processor";
import { Container, Contracts, Providers, Services, Utils as AppUtils } from "@solar-network/core-kernel";
import { TransactionValidator } from "@solar-network/core-state/dist/transaction-validator";
import { Handlers } from "@solar-network/core-transactions";
import { ColdWalletError } from "@solar-network/core-transactions/dist/errors";
import { Interfaces, Managers, Transactions, Utils } from "@solar-network/crypto";
import * as EthereumTx from '@ethereumjs/tx';
import assert from "assert";
import delay from "delay";
import InputDataDecoder from "ethereum-input-data-decoder";
import Web3 from "web3";
import { HttpProvider } from "web3-providers-http";

import { ApplyTransactionAction } from "./apply";
import {
    ApiCommunicationError,
    InvalidSignatureError,
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
    VendorFieldIncorrectError,
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

    @Container.inject(Container.Identifiers.TransactionPoolQuery)
    private readonly poolQuery!: Contracts.TransactionPool.Query;

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
            const duplicateSwapVendorFields = new Set(
                swapTransactions
                    .map((transaction) => transaction.data.vendorField)
                    .filter((vendorField, index, array) => array.indexOf(vendorField) !== index),
            );

            if (duplicateSwapVendorFields.size > 0) {
                for (const duplicateSwapVendorField of duplicateSwapVendorFields) {
                    const vendorFieldData: string[] =
                        typeof duplicateSwapVendorField === "string" ? duplicateSwapVendorField.split(":") : [];
                    if (vendorFieldData.length === 2) {
                        const [network, transactionId] = vendorFieldData;
                        swapTransactions
                            .filter((transaction) => transaction.data.vendorField === duplicateSwapVendorField)
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
            await (this as any).applyToSender(transaction, status);
            await this.applyToRecipient(transaction);
        };

        Handlers.TransactionHandler.prototype.applyToSender = async function (
            transaction: Interfaces.ITransaction,
            status?: string,
        ): Promise<void> {
            AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

            const sender: Contracts.State.Wallet = (this as any).walletRepository.findByPublicKey(
                transaction.data.senderPublicKey,
            );
            const data: Interfaces.ITransactionData = transaction.data;

            if (Utils.isException(data)) {
                self.log.warning(`Transaction forcibly applied as an exception: ${transaction.id}`);
            }

            await (this as any).throwIfCannotBeApplied(transaction, sender, status);

            if (data.version && data.version > 1) {
                (this as any).verifyTransactionNonceApply(sender, transaction);

                AppUtils.assert.defined<AppUtils.BigNumber>(data.nonce);
                sender.setNonce(data.nonce);
            } else {
                sender.increaseNonce();
            }

            const newBalance: Utils.BigNumber = sender.getBalance().minus(data.amount).minus(data.fee);
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

        (Handlers.Two.TransferTransactionHandler as any).prototype._throwIfCannotBeApplied =
            Handlers.Two.TransferTransactionHandler.prototype.throwIfCannotBeApplied;
        Handlers.Two.TransferTransactionHandler.prototype.throwIfCannotBeApplied = async function (
            transaction: Interfaces.ITransaction,
            sender: Contracts.State.Wallet,
            status?: string,
        ): Promise<void> {
            await (this as any)._throwIfCannotBeApplied(transaction, sender);
            AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

            const transactionData: Interfaces.ITransactionData = transaction.data;
            if (transactionData.senderPublicKey === swapWalletPublicKey) {
                const vendorFieldData: string[] =
                    typeof transactionData.vendorField === "string" ? transactionData.vendorField.split(":") : [];
                if (vendorFieldData.length !== 2) {
                    throw new VendorFieldIncorrectError();
                }

                const [network, transactionId] = vendorFieldData;

                try {
                    if (!supportedNetworks.includes(network)) {
                        throw new UnknownSwapNetworkError(network, supportedNetworks);
                    }

                    if (!/^0x[0-9a-f]{64}$/.test(transactionId)) {
                        throw new TransactionIdInvalidError();
                    }

                    const requests = peers[network].map((peer: Web3) =>
                        Promise.all([
                            peer.eth.currentProvider ? (peer.eth.currentProvider as HttpProvider).host : undefined,
                            self.getBlockNumber(peer),
                            self.getTransaction(transactionId, peer),
                            self.getReceipt(transactionId, peer)
                        ]),
                    );

                    const results: any = await Promise.any([
                        ...requests,
                        new Promise<undefined[]>(async (resolve) => {
                            await delay(2000);
                            resolve([]);
                        }),
                    ]).catch(() => {
                        return [];
                    });

                    const [api, height, txInfo, txReceipt] = results;

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
                        vendorField: transactionData.vendorField,
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

        (Handlers.Two.TransferTransactionHandler as any).prototype._throwIfCannotEnterPool =
            Handlers.Two.TransferTransactionHandler.prototype.throwIfCannotEnterPool;
        Handlers.Two.TransferTransactionHandler.prototype.throwIfCannotEnterPool = async function (
            transaction: Interfaces.ITransaction,
        ): Promise<void> {
            await (this as any)._throwIfCannotEnterPool(transaction);
            AppUtils.assert.defined<string>(transaction.data.senderPublicKey);

            const transactionData: Interfaces.ITransactionData = transaction.data;
            if (transactionData.senderPublicKey === swapWalletPublicKey) {
                const vendorFieldData: string[] =
                    typeof transactionData.vendorField === "string" ? transactionData.vendorField.split(":") : [];
                if (vendorFieldData.length !== 2) {
                    throw new VendorFieldIncorrectError();
                }

                const [network, transactionId] = vendorFieldData;

                const alreadyInPool: boolean = self.poolQuery
                    .getAllBySender(swapWalletPublicKey)
                    .wherePredicate((t) => t.data.vendorField === transactionData.vendorField)
                    .has();

                if (alreadyInPool) {
                    self.log.warning(
                        `Attempted duplication of swap transaction ${transactionId} (${network}) => ${transactionData.id} (native coin) rejected :gun:`,
                    );
                    throw new TransactionAlreadySubmittedError();
                }
            }
        };

        TransactionValidator.prototype.validate = async function (transaction: Interfaces.ITransaction): Promise<void> {
            const deserialized: Interfaces.ITransaction = Transactions.TransactionFactory.fromBytes(
                transaction.serialized,
            );
            assert.strictEqual(transaction.id, deserialized.id);
            const handler = await (this as any).handlerRegistry.getActivatedHandlerForData(transaction.data);
            await handler.apply(transaction, "validate");
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
                    reject();
                }
                resolve(blockNumber);
            } catch (err) {
                reject(err);
            }
        });
    }

    private async getTransaction(transactionId, peer) {
        return new Promise(async (resolve, reject) => {
            try {
                const transaction = await peer.eth.getTransaction(transactionId);
                if (!transaction) {
                    reject();
                }
                resolve(transaction);
            } catch (err) {
                reject(err);
            }
        });
    }

    private async getReceipt(transactionId, peer) {
        return new Promise(async (resolve, reject) => {
            try {
                const receipt = await peer.eth.getTransactionReceipt(transactionId);
                if (!receipt) {
                    reject();
                }
                resolve(receipt);
            } catch (err) {
                reject(err);
            }
        });
    }
}
