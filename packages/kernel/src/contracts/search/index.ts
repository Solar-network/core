export * from "./criteria";
export * from "./expressions";

export type Sorting = {
    property: string;
    direction: "asc" | "desc";
}[];

export type Pagination = {
    offset: number;
    limit: number;
};

export type ResultsPage<T> = {
    results: T[];
    totalCount: number;
};
