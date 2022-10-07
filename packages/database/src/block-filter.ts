import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { BlockModel } from "./models";

const { handleAndCriteria, handleOrCriteria, handleNumericCriteria, optimiseExpression } = AppUtils.Search;

@Container.injectable()
export class BlockFilter implements Contracts.Database.BlockFilter {
    public async getExpression(
        ...criteria: Contracts.Shared.OrBlockCriteria[]
    ): Promise<Contracts.Search.Expression<Partial<BlockModel>>> {
        const expressions = await Promise.all(
            criteria.map((c) => handleOrCriteria(c, (c) => this.handleBlockCriteria(c))),
        );

        return optimiseExpression({ op: "and", expressions });
    }

    private async handleBlockCriteria(
        criteria: Contracts.Shared.BlockCriteria,
    ): Promise<Contracts.Search.Expression<BlockModel>> {
        return handleAndCriteria(criteria, async (key) => {
            switch (key) {
                case "id":
                    return handleOrCriteria(criteria.id!, async (c) => {
                        return { property: "id", op: "like", pattern: c.toString() + "*" };
                    });
                case "version":
                    return handleOrCriteria(criteria.version!, async (c) => {
                        return { property: "version", op: "equal", value: c };
                    });
                case "timestamp":
                    return handleOrCriteria(criteria.timestamp!, async (c) => {
                        return handleNumericCriteria("timestamp", c);
                    });
                case "previousBlock":
                    return handleOrCriteria(criteria.previousBlock!, async (c) => {
                        return { property: "previousBlock", op: "equal", value: c };
                    });
                case "height":
                    return handleOrCriteria(criteria.height!, async (c) => {
                        return handleNumericCriteria("height", c);
                    });
                case "numberOfTransactions":
                    return handleOrCriteria(criteria.numberOfTransactions!, async (c) => {
                        return handleNumericCriteria("numberOfTransactions", c);
                    });
                case "totalAmount":
                    return handleOrCriteria(criteria.totalAmount!, async (c) => {
                        return handleNumericCriteria("totalAmount", c);
                    });
                case "totalFee":
                    return handleOrCriteria(criteria.totalFee!, async (c) => {
                        return handleNumericCriteria("totalFee", c);
                    });
                case "totalFeeBurned":
                    return handleOrCriteria(criteria.totalFeeBurned!, async (c) => {
                        return handleNumericCriteria("totalFeeBurned", c);
                    });
                case "reward":
                    return handleOrCriteria(criteria.reward!, async (c) => {
                        return handleNumericCriteria("reward", c);
                    });
                case "payloadLength":
                    return handleOrCriteria(criteria.payloadLength!, async (c) => {
                        return handleNumericCriteria("payloadLength", c);
                    });
                case "payloadHash":
                    return handleOrCriteria(criteria.payloadHash!, async (c) => {
                        return { property: "payloadHash", op: "equal", value: c };
                    });
                case "generatorPublicKey":
                    return handleOrCriteria(criteria.generatorPublicKey!, async (c) => {
                        return { property: "generatorPublicKey", op: "equal", value: c };
                    });
                case "username":
                    return handleOrCriteria(criteria.username!, async (c) => {
                        return { property: "username", op: "equal", value: c };
                    });
                case "signature":
                    return handleOrCriteria(criteria.signature!, async (c) => {
                        return { property: "signature", op: "equal", value: c };
                    });
                default:
                    return { op: "true" };
            }
        });
    }
}
