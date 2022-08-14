import { Options, OrCriteria, OrEqualCriteria, OrNumericCriteria, Pagination, ResultsPage, Sorting } from "../search";

export type MissedBlockCriteria = {
    timestamp?: OrNumericCriteria<number>;
    height?: OrNumericCriteria<number>;
    username?: OrEqualCriteria<string>;
};

export type OrMissedBlockCriteria = OrCriteria<MissedBlockCriteria>;

export interface MissedBlockHistoryService {
    listByCriteria(
        criteria: OrMissedBlockCriteria,
        sorting: Sorting,
        pagination: Pagination,
        options?: Options,
    ): Promise<ResultsPage<{ timestamp: number; height: number; username: string }>>;
}
