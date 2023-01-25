import { OrCriteria, OrEqualCriteria, OrNumericCriteria, Pagination, ResultsPage, Sorting } from "../search";

export type BlockProductionFailureCriteria = {
    timestamp?: OrNumericCriteria<number>;
    height?: OrNumericCriteria<number>;
    username?: OrEqualCriteria<string>;
};

export type OrBlockProductionFailureCriteria = OrCriteria<BlockProductionFailureCriteria>;

export interface BlockProductionFailureHistoryService {
    listByCriteria(
        criteria: OrBlockProductionFailureCriteria,
        sorting: Sorting,
        pagination: Pagination,
        count?: boolean,
    ): Promise<ResultsPage<{ timestamp: number; height: number; username: string }>>;
}
