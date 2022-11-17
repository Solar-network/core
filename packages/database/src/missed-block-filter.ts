import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { MissedBlockModel } from "./models";

const { handleAndCriteria, handleOrCriteria, handleNumericCriteria, optimiseExpression } = AppUtils.Search;

@Container.injectable()
export class MissedBlockFilter implements Contracts.Database.MissedBlockFilter {
    public async getExpression(
        ...criteria: Contracts.Shared.OrBlockCriteria[]
    ): Promise<Contracts.Search.Expression<Partial<MissedBlockModel>>> {
        const expressions = await Promise.all(
            criteria.map((c) => handleOrCriteria(c, (c) => this.handleMissedBlockCriteria(c))),
        );

        return optimiseExpression({ op: "and", expressions });
    }

    private async handleMissedBlockCriteria(
        criteria: Contracts.Shared.MissedBlockCriteria,
    ): Promise<Contracts.Search.Expression<MissedBlockModel>> {
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
