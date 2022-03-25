import Hapi from "@hapi/hapi";
import { Repositories } from "@solar-network/core-database";
import { Container, Contracts, Utils } from "@solar-network/core-kernel";

import { Controller } from "./controller";

export class BlockchainController extends Controller {
    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private readonly transactionRepository!: Repositories.TransactionRepository;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async index(request: Hapi.Request, h: Hapi.ResponseToolkit) {
        const { data } = this.stateStore.getLastBlock();

        const fees = Utils.BigNumber.make(await this.transactionRepository.getFeesBurned());
        const transactions = Utils.BigNumber.make(await this.transactionRepository.getBurnTransactionTotal());
        const total = fees.plus(transactions);

        return {
            data: {
                block: {
                    height: data.height,
                    id: data.id,
                },
                burned: {
                    fees,
                    transactions,
                    total,
                },
                supply: Utils.supplyCalculator.calculate(this.walletRepository.allByAddress()),
            },
        };
    }
}
