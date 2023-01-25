import { Expression } from "../search";
import { OrBlockProductionFailureCriteria } from "../shared/block-production-failure-history-service";
import { BlockProductionFailureModel } from "./models";

export interface BlockProductionFailureFilter {
    getExpression(...criteria: OrBlockProductionFailureCriteria[]): Promise<Expression<BlockProductionFailureModel>>;
}
