import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { BlockProductionFailureModel } from "./models";

const { handleAndCriteria, handleOrCriteria, handleNumericCriteria, optimiseExpression } = AppUtils.Search;

@Container.injectable()
export class BlockProductionFailureFilter implements Contracts.Database.BlockProductionFailureFilter {
    public async getExpression(
        ...criteria: Contracts.Shared.OrBlockCriteria[]
    ): Promise<Contracts.Search.Expression<Partial<BlockProductionFailureModel>>> {
        const expressions = await Promise.all(
            criteria.map((c) => handleOrCriteria(c, (c) => this.handleBlockProductionFailureCriteria(c))),
        );

        return optimiseExpression({ op: "and", expressions });
    }

    private async handleBlockProductionFailureCriteria(
        criteria: Contracts.Shared.BlockProductionFailureCriteria,
    ): Promise<Contracts.Search.Expression<BlockProductionFailureModel>> {
        return handleAndCriteria(criteria, async (key) => {
            switch (key) {
                case "timestamp":
                    return handleOrCriteria(criteria.timestamp!, async (c) => {
                        return handleNumericCriteria("timestamp", c);
                    });
                case "height":
                    return handleOrCriteria(criteria.height!, async (c) => {
                        return handleNumericCriteria("height", c);
                    });
                case "username":
                    return handleOrCriteria(criteria.username!, async (c) => {
                        return { property: "username", op: "equal", value: c };
                    });
                default:
                    return { op: "true" };
            }
        });
    }
}
