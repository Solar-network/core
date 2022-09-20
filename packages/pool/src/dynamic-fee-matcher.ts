import { Interfaces, Managers, Utils } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

import { TransactionFeeTooLowError } from "./errors";

@Container.injectable()
export class DynamicFeeMatcher implements Contracts.Pool.DynamicFeeMatcher {
    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "blockchain")
    private readonly handlerRegistry!: Handlers.Registry;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    public async throwIfCannotEnterPool(transaction: Interfaces.ITransaction): Promise<void> {
        const milestone = Managers.configManager.getMilestone();

        const feeStr = Utils.formatSatoshi(transaction.data.fee);

        const handler = await this.handlerRegistry.getActivatedHandlerForData(transaction.data);
        const { emoji } = handler.getConstructor();

        const minFeePool: Utils.BigNumber = handler.getMinimumFee(transaction, milestone.dynamicFees);

        const minFeeStr = Utils.formatSatoshi(minFeePool);

        if (transaction.data.fee.isGreaterThanEqual(minFeePool)) {
            this.logger.trace(`${transaction} eligible to enter pool (fee ${feeStr} >= ${minFeeStr})`, emoji);
            return;
        }

        this.logger.trace(`${transaction} not eligible to enter pool (fee ${feeStr} < ${minFeeStr})`, "⚡");
        throw new TransactionFeeTooLowError(transaction);
    }

    public async throwIfCannotBroadcast(transaction: Interfaces.ITransaction): Promise<void> {
        const milestone = Managers.configManager.getMilestone();
        const handler = await this.handlerRegistry.getActivatedHandlerForData(transaction.data);

        const minFeeBroadcast: Utils.BigNumber = handler.getMinimumFee(transaction, milestone.dynamicFees);

        if (!transaction.data.fee.isGreaterThanEqual(minFeeBroadcast)) {
            throw new TransactionFeeTooLowError(transaction);
        }
    }
}
