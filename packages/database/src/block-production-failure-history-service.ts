import { Interfaces, Managers } from "@solar-network/crypto";
import { Container, Contracts, Providers, Utils } from "@solar-network/kernel";

import { BlockProductionFailureRepository } from "./repositories";

@Container.injectable()
export class BlockProductionFailureHistoryService implements Contracts.Shared.BlockProductionFailureHistoryService {
    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/blockchain")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.DatabaseBlockFilter)
    private readonly blockProductionFailureFilter!: Contracts.Database.BlockProductionFailureFilter;

    @Container.inject(Container.Identifiers.DatabaseBlockProductionFailureRepository)
    private readonly blockProductionFailureRepository!: BlockProductionFailureRepository;

    public async listByCriteria(
        criteria: Contracts.Shared.OrBlockCriteria,
        sorting: Contracts.Search.Sorting,
        pagination: Contracts.Search.Pagination,
        count: boolean = true,
    ): Promise<Contracts.Search.ResultsPage<{ timestamp: number; height: number; username: string }>> {
        const lastBlock: Interfaces.IBlock = this.blockchain.getLastBlock();
        const timestamp =
            (new Date(Utils.formatTimestamp(lastBlock.data.timestamp).unix * 1000).setUTCHours(0, 0, 0, 0) -
                new Date(Managers.configManager.getMilestone(1).epoch).getTime()) /
            1000;
        const earliestTimestamp = timestamp - (this.configuration.get("blockProductionFailuresLookback") as number);

        let clonedCriteria = Utils.cloneDeep(criteria);
        if (!Array.isArray(clonedCriteria)) {
            clonedCriteria = [clonedCriteria];
        }

        for (const criterion of clonedCriteria) {
            if (typeof criterion.timestamp !== "undefined") {
                if (typeof criterion.timestamp === "number") {
                    if (criterion.timestamp < earliestTimestamp) {
                        criterion.timestamp = 0;
                    }
                } else if (typeof criterion.timestamp === "object") {
                    if (
                        typeof criterion.timestamp["from"] !== "number" ||
                        criterion.timestamp["from"] < earliestTimestamp
                    ) {
                        criterion.timestamp["from"] = earliestTimestamp;
                    }
                }
            } else {
                criterion.timestamp = { from: earliestTimestamp };
            }
        }

        const expression = await this.blockProductionFailureFilter.getExpression(clonedCriteria);
        const modelResultsPage = await this.blockProductionFailureRepository.listByExpression(
            expression,
            sorting,
            pagination,
            count,
        );
        const data = modelResultsPage.results;
        return { ...modelResultsPage, results: data };
    }
}
