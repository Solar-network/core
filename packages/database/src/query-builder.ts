import { Utils } from "@solar-network/crypto";
import { Contracts } from "@solar-network/kernel";

type DatabaseValue = boolean | string | number | Utils.BigNumber | Buffer;
type WhereParameter = Record<string, DatabaseValue> | Buffer[] | number[];

export class QueryBuilder implements Contracts.Database.QueryBuilder {
    public table: string = "";

    private action: string = "";
    private columns: string[] = [];
    private groups: string[] = [];
    private insertParameters: Record<string, any> = {};
    private limitRange: string = "";
    private params: Map<string, number> = new Map();
    private subqueries: string[] = [];
    private crossJoins: {
        table: string;
        criteria: string;
        parameters?: Record<string, DatabaseValue>;
    }[] = [];
    private queryRunner: Contracts.Database.QueryRunner | undefined;

    private whereCriteria: {
        criteria: string;
        operation: string;
        parameters?: WhereParameter;
    }[] = [];
    private orders: {
        column: string;
        direction: string;
    }[] = [];

    public constructor(queryRunner?: Contracts.Database.QueryRunner) {
        this.queryRunner = queryRunner;
    }

    public addParam(param: string): string {
        if (!this.params.has(param)) {
            this.params.set(param, 1);
            return param;
        }

        const count = this.params.get(param)!;
        this.params.set(param, count + 1);
        return `${param}__${count}`;
    }
    public select(column: string, alias?: string): QueryBuilder {
        if (alias) {
            column += ` ${alias}`;
        }

        this.action = "SELECT";
        this.columns.push(column);
        return this;
    }

    public insert(column: string, value: Record<string, any>): QueryBuilder {
        this.columns.push(column);
        for (const [k, v] of Object.entries(value)) {
            let insertValue = v;
            if (v instanceof Utils.BigNumber) {
                insertValue = v.toString();
            }
            if (typeof v === "boolean") {
                insertValue = +v;
            }
            this.insertParameters[k] = { query: insertValue };
        }
        this.action = "INSERT";
        return this;
    }

    public insertSubquery(column: string, subquery: string, value?: Record<string, any>): QueryBuilder {
        this.columns.push(column);
        this.subqueries.push(subquery);
        if (value) {
            for (const [k, v] of Object.entries(value)) {
                let insertValue = v;
                if (v instanceof Utils.BigNumber) {
                    insertValue = v.toString();
                }
                if (typeof v === "boolean") {
                    insertValue = +v;
                }
                this.insertParameters[k] = { subquery: insertValue };
            }
        }
        this.action = "INSERT";
        return this;
    }

    public ignore(): QueryBuilder {
        if (this.action === "INSERT") {
            this.action = "INSERT OR IGNORE";
        }

        return this;
    }

    public delete(): QueryBuilder {
        this.action = "DELETE";
        return this;
    }

    public from(table: string, alias?: string): QueryBuilder {
        if (alias) {
            table += ` ${alias}`;
        }

        this.table = table;
        return this;
    }

    public into(table: string): QueryBuilder {
        this.table = table;
        return this;
    }

    public where(criteria: string, params?: WhereParameter): QueryBuilder {
        return this.generateWhere(criteria, "AND", params);
    }

    public orWhere(criteria: string, params?: WhereParameter): QueryBuilder {
        return this.generateWhere(criteria, "OR", params);
    }

    public orderBy(column: string, direction: string): QueryBuilder {
        this.orders.push({ column, direction });
        return this;
    }

    public groupBy(column: string): QueryBuilder {
        this.groups.push(column);
        return this;
    }

    public limit(start: number, end: number): QueryBuilder {
        this.limitRange = `${start}, ${end}`;
        return this;
    }

    public crossJoin(table: string, criteria: string, params?: Record<string, DatabaseValue>): QueryBuilder {
        const parameters: Record<string, DatabaseValue> = this.convertParameters(params) as Record<
            string,
            DatabaseValue
        >;
        this.crossJoins.push({ table, criteria, parameters });

        this.crossJoins = this.crossJoins.filter(
            (value, index, self) =>
                index === self.findIndex((entry) => entry.table === value.table && entry.criteria === value.criteria),
        );

        return this;
    }

    public getQuery(): { query: string; parameters: WhereParameter | DatabaseValue[] } {
        let query = this.action;
        let parameters: WhereParameter | DatabaseValue[] = [];
        switch (this.action) {
            case "DELETE": {
                query += ` FROM ${this.table}`;
                break;
            }
            case "INSERT":
            case "INSERT OR IGNORE": {
                const queryParams = {};
                const subqueryParams = {};
                for (const [key, value] of Object.entries(this.insertParameters)) {
                    if (value.query !== undefined) {
                        queryParams[key] = value.query;
                    } else if (value.subquery !== undefined) {
                        subqueryParams[key] = value.subquery;
                    }
                }

                const paramKeys = Object.keys(queryParams);

                if (paramKeys.length > 0 && this.subqueries.length > 0) {
                    this.subqueries.unshift("");
                }

                query += ` INTO ${this.table} (${this.columns.join(", ")}) VALUES (${paramKeys
                    .map((param) => `:${param}`)
                    .join(", ")}${this.subqueries.join(", ")})`;
                parameters = {
                    ...parameters,
                    ...queryParams,
                    ...subqueryParams,
                };
                break;
            }
            case "SELECT": {
                query += ` ${this.columns.join(", ")} FROM ${this.table}`;
                for (const crossJoin of this.crossJoins) {
                    query += ` CROSS JOIN ${crossJoin.table} ON ${crossJoin.criteria}`;
                    if (crossJoin.parameters) {
                        parameters = {
                            ...parameters,
                            ...crossJoin.parameters,
                        };
                    }
                }

                break;
            }
        }

        if (["DELETE", "SELECT"].includes(this.action)) {
            for (let i = 0; i < this.whereCriteria.length; i++) {
                let operation: string = "WHERE";
                if (i > 0) {
                    operation = this.whereCriteria[i].operation;
                }
                query += ` ${operation} ${this.whereCriteria[i].criteria}`;
                if (this.whereCriteria[i].parameters) {
                    if (Array.isArray(this.whereCriteria[i].parameters)) {
                        parameters = this.whereCriteria[i].parameters!;
                    } else {
                        parameters = {
                            ...parameters,
                            ...this.whereCriteria[i].parameters,
                        };
                    }
                }
            }
        }

        if (this.action === "SELECT") {
            if (this.groups.length > 0) {
                query += " GROUP BY " + this.groups.join(", ");
            }

            if (this.orders.length > 0) {
                query +=
                    " ORDER BY " + this.orders.map((order) => `${order.column} ${order.direction ?? "ASC"}`).join(", ");
            }
        }

        if (this.limitRange && ["DELETE", "SELECT"].includes(this.action)) {
            query += ` LIMIT ${this.limitRange}`;
        }

        return { query, parameters };
    }

    public async run(): Promise<any[]> {
        if (this.queryRunner) {
            const { query, parameters } = this.getQuery();
            return await this.queryRunner.query(query, parameters);
        }

        return [];
    }

    private generateWhere(criteria: string, operation: string, params?: WhereParameter): QueryBuilder {
        const parameters: WhereParameter = this.convertParameters(params);
        this.whereCriteria.push({ criteria, operation, parameters });
        return this;
    }

    private convertParameters(params?: WhereParameter): WhereParameter {
        const parameters: WhereParameter = Array.isArray(params) ? [] : {};
        if (params) {
            for (const [key, value] of Object.entries(params)) {
                let parameter = value;
                if (value instanceof Utils.BigNumber) {
                    parameter = value.toString();
                } else if (typeof value === "boolean") {
                    parameter = +value;
                } else if (typeof value === "object") {
                    parameter = Buffer.from(value);
                }

                parameters[key] = parameter;
            }
        }

        return parameters;
    }
}
