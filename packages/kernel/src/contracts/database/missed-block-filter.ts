import { Expression } from "../search";
import { OrMissedBlockCriteria } from "../shared/missed-block-history-service";
import { MissedBlockModel } from "./models";

export interface MissedBlockFilter {
    getExpression(...criteria: OrMissedBlockCriteria[]): Promise<Expression<MissedBlockModel>>;
}
