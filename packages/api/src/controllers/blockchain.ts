import Hapi from "@hapi/hapi";
import { Managers, Utils } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { Identifiers } from "../identifiers";
import { WalletSearchResource } from "../resources-new";
import { WalletSearchService } from "../services";
import { Controller } from "./controller";

export class BlockchainController extends Controller {
    @Container.inject(Container.Identifiers.BlockHistoryService)
    private readonly blockHistoryService!: Contracts.Shared.BlockHistoryService;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    private readonly transactionRepository!: Contracts.Database.TransactionRepository;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Identifiers.WalletSearchService)
    private readonly walletSearchService!: WalletSearchService;

    public async index(_: Hapi.Request, h: Hapi.ResponseToolkit) {
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
                supply: AppUtils.supplyCalculator.calculate(this.walletRepository.allByAddress()),
            },
        };
    }

    public async search(request: Hapi.Request, h: Hapi.ResponseToolkit) {
        const network = Managers.configManager.get("network");

        const blockProducersRegex: RegExp = new RegExp("^(?!_)(?=.*[a-z!@$&_.])([a-z0-9!@$&_.]?){1,20}$", "i");
        const hexRegex: RegExp = new RegExp("^([a-z0-9]){21,64}$", "i");
        const publicKeysRegex: RegExp = new RegExp("^0([23]){1}([a-z0-9]){19,64}$", "i");
        const numbersRegex: RegExp = new RegExp("^([0-9]){1,9}$");
        const walletsRegex: RegExp = new RegExp(`^(${network.addressCharacter})([a-z1-9]{20,33})$`, "i");

        const blocks: Contracts.Shared.BlockSearchResource[] = [];
        const transactions: Contracts.Shared.TransactionSearchResource[] = [];
        const wallets: WalletSearchResource[] = [];

        if (
            blockProducersRegex.test(request.params.id) ||
            publicKeysRegex.test(request.params.id) ||
            walletsRegex.test(request.params.id)
        ) {
            wallets.push(...this.walletSearchService.getWalletsLike(request.params.id));
        }

        if (hexRegex.test(request.params.id)) {
            blocks.push(...(await this.blockHistoryService.getBlocksLike(request.params.id)));
            transactions.push(...(await this.transactionHistoryService.getTransactionsLike(request.params.id)));
        } else if (numbersRegex.test(request.params.id)) {
            blocks.push(...(await this.blockHistoryService.getBlocksLike(+request.params.id)));
        }

        return { data: { blocks, transactions, wallets } };
    }
}
