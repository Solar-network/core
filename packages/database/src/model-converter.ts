import { Interfaces, Transactions, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { BlockModel, TransactionModel } from "./models";

@Container.injectable()
export class ModelConverter implements Contracts.Database.ModelConverter {
    public getBlockModels(blocks: Interfaces.IBlock[]): Contracts.Database.BlockModel[] {
        return blocks.map((b) => Object.assign(new BlockModel(), b.data));
    }

    public getBlockData(models: Contracts.Database.BlockModel[]): Interfaces.IBlockData[] {
        return models.map((model) => {
            if (model.username === null) {
                delete model.username;
            }
            model.totalFeeBurned = Utils.BigNumber.make(model.totalFeeBurned ?? Utils.BigNumber.ZERO);
            model.donations = Utils.calculateDonations(model.height, model.reward);
            return model;
        });
    }

    public getBlockDataWithTransactionData(
        blockModels: Contracts.Database.BlockModel[],
        transactionModels: Contracts.Database.TransactionModel[],
    ): Contracts.Shared.BlockDataWithTransactionData[] {
        const blockData = this.getBlockData(blockModels);
        const transactionData = this.getTransactionData(transactionModels);

        const blockDataWithTransactions = blockData.map((data) => {
            const transactions = transactionData.filter((t) => t.blockHeight === data.height);
            return { data, transactions };
        });

        return blockDataWithTransactions;
    }

    public getTransactionModels(transactions: Interfaces.ITransaction[]): Contracts.Database.TransactionModel[] {
        return transactions.map((t) => {
            return Object.assign(new TransactionModel(), t.data, {
                timestamp: t.timestamp,
                serialised: t.serialised,
            });
        });
    }

    public getTransactionData(models: Contracts.Database.TransactionModel[]): Interfaces.ITransactionData[] {
        return models.map((model) => {
            const data = Transactions.TransactionFactory.fromBytesUnsafe(model.serialised, model.id).data;
            data.blockHeight = model.blockHeight;
            data.burnedFee = model.burnedFee;
            data.sequence = model.sequence;
            data.timestamp = model.timestamp;

            return data;
        });
    }

    public getTransactionDataWithBlockData(
        transactionModels: Contracts.Database.TransactionModel[],
        blockModels: Contracts.Database.BlockModel[],
    ): Contracts.Shared.TransactionDataWithBlockData[] {
        const transactionData = this.getTransactionData(transactionModels);
        const blockData = this.getBlockData(blockModels);

        return transactionData.map((data) => {
            const block = blockData.find((b) => b.height === data.blockHeight);
            AppUtils.assert.defined<Interfaces.IBlockData>(block);
            return { data, block };
        });
    }
}
