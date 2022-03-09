import { Container, Contracts, Providers } from "@solar-network/core-kernel";
import { Handlers } from "@solar-network/core-transactions";
import { Interfaces, Managers, Utils } from "@solar-network/crypto";

import { TransactionFeeTooHighError, TransactionFeeTooLowError } from "./errors";

@Container.injectable()
export class DynamicFeeMatcher implements Contracts.TransactionPool.DynamicFeeMatcher {
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/core-transaction-pool")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "blockchain")
    private readonly handlerRegistry!: Handlers.Registry;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        const milestone = Managers.configManager.getMilestone();

        let dynamicFeesConfiguration: { addonBytes: object; enabled: boolean; minFee: number } | Record<string, any>;
        const feeStr = Utils.formatSatoshi(transaction.data.fee);

        if (milestone.dynamicFees && milestone.dynamicFees.enabled) {
            dynamicFeesConfiguration = milestone.dynamicFees;
        } else {
            dynamicFeesConfiguration = this.configuration.getRequired<Record<string, any>>("dynamicFees");
            dynamicFeesConfiguration.minFee = dynamicFeesConfiguration.minFeePool;
        }

        if (dynamicFeesConfiguration.enabled) {
            const handler = await this.handlerRegistry.getActivatedHandlerForData(transaction.data);

            const minFeePool: Utils.BigNumber = handler.getMinimumFee(transaction, dynamicFeesConfiguration);

            const minFeeStr = Utils.formatSatoshi(minFeePool);

            if (transaction.data.fee.isGreaterThanEqual(minFeePool)) {
                this.logger.debug(
                    `${transaction} eligible to enter pool (fee ${feeStr} >= ${minFeeStr}) :money_with_wings:`,
                );
                return;
            }

            this.logger.notice(`${transaction} not eligible to enter pool (fee ${feeStr} < ${minFeeStr}) :zap:`);
            throw new TransactionFeeTooLowError(transaction);
        } else {
            const staticFeeStr = Utils.formatSatoshi(transaction.staticFee);

            if (transaction.data.fee.isEqualTo(transaction.staticFee)) {
                this.logger.debug(
                    `${transaction} eligible to enter pool (fee ${feeStr} = ${staticFeeStr}) :money_with_wings:`,
                );
                return;
            }
            if (transaction.data.fee.isLessThan(transaction.staticFee)) {
                this.logger.notice(`${transaction} not eligible to enter pool (fee ${feeStr} < ${staticFeeStr}) :zap:`);
                throw new TransactionFeeTooLowError(transaction);
            }

            this.logger.notice(`${transaction} not eligible to enter pool (fee ${feeStr} > ${staticFeeStr}) :zap:`);
            throw new TransactionFeeTooHighError(transaction);
        }
    }

    public async throwIfCannotBroadcast(transaction: Interfaces.ITransaction): Promise<void> {
        const milestone = Managers.configManager.getMilestone();

        let dynamicFeesConfiguration: { addonBytes: object; enabled: boolean; minFee: number } | Record<string, any>;
        const feeStr = Utils.formatSatoshi(transaction.data.fee);

        if (milestone.dynamicFees && milestone.dynamicFees.enabled) {
            dynamicFeesConfiguration = milestone.dynamicFees;
        } else {
            dynamicFeesConfiguration = this.configuration.getRequired<Record<string, any>>("dynamicFees");
            dynamicFeesConfiguration.minFee = dynamicFeesConfiguration.minFeeBroadcast;
        }

        if (dynamicFeesConfiguration.enabled) {
            const handler = await this.handlerRegistry.getActivatedHandlerForData(transaction.data);

            const minFeeBroadcast: Utils.BigNumber = handler.getMinimumFee(transaction, dynamicFeesConfiguration);

            const minFeeStr = Utils.formatSatoshi(minFeeBroadcast);

            if (transaction.data.fee.isGreaterThanEqual(minFeeBroadcast)) {
                if (!milestone.dynamicFees || !milestone.dynamicFees.enabled) {
                    this.logger.debug(
                        `${transaction} eligible for broadcast (fee ${feeStr} >= ${minFeeStr}) :earth_africa:`,
                    );
                }
                return;
            }
            if (!milestone.dynamicFees || !milestone.dynamicFees.enabled) {
                this.logger.notice(`${transaction} not eligible for broadcast (fee ${feeStr} < ${minFeeStr}) :zap:`);
            }
            throw new TransactionFeeTooLowError(transaction);
        } else {
            const staticFeeStr = Utils.formatSatoshi(transaction.staticFee);

            if (transaction.data.fee.isEqualTo(transaction.staticFee)) {
                this.logger.debug(`${transaction} eligible for broadcast (fee ${feeStr} = ${staticFeeStr})`);
                return;
            }
            if (transaction.data.fee.isLessThan(transaction.staticFee)) {
                this.logger.notice(`${transaction} not eligible to enter pool (fee ${feeStr} < ${staticFeeStr}) :zap:`);
                throw new TransactionFeeTooLowError(transaction);
            }

            this.logger.notice(`${transaction} not eligible to enter pool (fee ${feeStr} > ${staticFeeStr}) :zap:`);
            throw new TransactionFeeTooHighError(transaction);
        }
    }
}
