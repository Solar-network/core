import Hapi from "@hapi/hapi";
import { Managers, Utils } from "@solar-network/crypto";
import { Repositories } from "@solar-network/database";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { Identifiers } from "../identifiers";
import { WalletSearchResource } from "../resources-new";
import { WalletSearchService } from "../services";
import { Controller } from "./controller";

// Burn totals only change when a new block carrying burned fees or burn
// transactions is forged, so recomputing them on every /blockchain request
// is wasteful — both queries are unbounded SUMs over the transactions table
// and take tens of seconds on a mature mainnet. Cache the result and refresh
// lazily in the background; a stale-but-fresh-on-read pattern is fine for an
// endpoint whose primary consumers are explorer dashboards.
interface BurnCache {
    fees: string;
    transactions: string;
    ts: number;
    refreshing: Promise<void> | null;
}

const burnCache: BurnCache = {
    fees: "0",
    transactions: "0",
    ts: 0,
    refreshing: null,
};

const BURN_CACHE_TTL_MS = 10 * 60 * 1000;

export class BlockchainController extends Controller {
    @Container.inject(Container.Identifiers.BlockHistoryService)
    @Container.tagged("connection", "api")
    private readonly blockHistoryService!: Contracts.Shared.BlockHistoryService;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.TransactionHistoryService)
    @Container.tagged("connection", "api")
    private readonly transactionHistoryService!: Contracts.Shared.TransactionHistoryService;

    @Container.inject(Container.Identifiers.DatabaseTransactionRepository)
    @Container.tagged("connection", "api")
    private readonly transactionRepository!: Repositories.TransactionRepository;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    @Container.inject(Identifiers.WalletSearchService)
    private readonly walletSearchService!: WalletSearchService;

    public async index(_: Hapi.Request, h: Hapi.ResponseToolkit) {
        const { data } = this.stateStore.getLastBlock();

        if (Date.now() - burnCache.ts > BURN_CACHE_TTL_MS && !burnCache.refreshing) {
            const repo = this.transactionRepository;
            burnCache.refreshing = (async () => {
                try {
                    const [feesRaw, txRaw] = await Promise.all([
                        repo.getFeesBurned(),
                        repo.getBurnTransactionTotal(),
                    ]);
                    burnCache.fees = String(feesRaw);
                    burnCache.transactions = String(txRaw);
                    burnCache.ts = Date.now();
                } finally {
                    burnCache.refreshing = null;
                }
            })();
        }

        const fees = Utils.BigNumber.make(burnCache.fees);
        const transactions = Utils.BigNumber.make(burnCache.transactions);
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

        const delegatesRegex: RegExp = new RegExp("^(?!_)(?=.*[a-z!@$&_.])([a-z0-9!@$&_.]?){1,20}$", "i");
        const hexRegex: RegExp = new RegExp("^([a-z0-9]){21,64}$", "i");
        const publicKeysRegex: RegExp = new RegExp("^0([23]){1}([a-z0-9]){19,64}$", "i");
        const walletsRegex: RegExp = new RegExp(`^(${network.addressCharacter})([a-z1-9]{20,33})$`, "i");

        const blocks: Contracts.Shared.BlockSearchResource[] = [];
        const transactions: Contracts.Shared.TransactionSearchResource[] = [];
        const wallets: WalletSearchResource[] = [];

        if (
            delegatesRegex.test(request.params.id) ||
            publicKeysRegex.test(request.params.id) ||
            walletsRegex.test(request.params.id)
        ) {
            wallets.push(...this.walletSearchService.getWalletsLike(request.params.id));
        }

        if (hexRegex.test(request.params.id)) {
            blocks.push(...(await this.blockHistoryService.getBlocksLike(request.params.id)));
            transactions.push(...(await this.transactionHistoryService.getTransactionsLike(request.params.id)));
        }

        return { data: { blocks, transactions, wallets } };
    }
}
