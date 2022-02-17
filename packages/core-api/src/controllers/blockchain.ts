import { Container, Contracts, Utils } from "@arkecosystem/core-kernel";

import { Controller } from "./controller";

export class BlockchainController extends Controller {
    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async index() {
        const { data } = this.stateStore.getLastBlock();

        return {
            data: {
                block: {
                    height: data.height,
                    id: data.id,
                },
                supply: Utils.supplyCalculator.calculate(this.walletRepository.allByAddress()),
            },
        };
    }
}
