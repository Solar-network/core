import { Utils } from "@solar-network/crypto";

type DatabaseValue = boolean | string | number | Utils.BigNumber | Buffer;
type WhereParameter = Record<string, DatabaseValue> | Buffer[] | number[];

export interface QueryBuilder {
    table: string;

    addParam(param: string): string;
    select(column: string, alias?: string): QueryBuilder;
    insert(column: string, value: Record<string, any>): QueryBuilder;
    insertSubquery(column: string, subquery: string, value?: Record<string, any>): QueryBuilder;
    ignore(): QueryBuilder;
    delete(): QueryBuilder;
    from(table: string, alias?: string): QueryBuilder;
    into(table: string): QueryBuilder;
    where(criteria: string, params?: WhereParameter): QueryBuilder;
    orWhere(criteria: string, params?: WhereParameter): QueryBuilder;
    orderBy(column: string, direction: "ASC" | "DESC"): QueryBuilder;
    groupBy(column: string): QueryBuilder;
    limit(start: number, end: number): QueryBuilder;
    crossJoin(table: string, criteria: string, parameters?: Record<string, DatabaseValue>): QueryBuilder;
    getQuery(): { query: string; parameters: Record<string, any> };
    run(): Promise<any[]>;
}
