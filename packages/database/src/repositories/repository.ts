import { Enums } from "@solar-network/crypto";
import { Container, Contracts } from "@solar-network/kernel";

import { QueryBuilder } from "../query-builder";

export interface IModel {
    [key: string]: any;
}

@Container.injectable()
export abstract class Repository<T extends IModel> implements Contracts.Database.Repository {
    @Container.inject(Container.Identifiers.LogService)
    public readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.DatabaseQueryRunner)
    public readonly queryRunner!: Contracts.Database.QueryRunner;

    protected model!: { to: Function };

    public createQueryBuilder(): Contracts.Database.QueryBuilder {
        return new QueryBuilder(this.queryRunner);
    }

    public toModel(model: { to: Function }, raw: Record<string, any>[]): T[] {
        return raw.map((row) => model.to(row));
    }

    public async findManyByExpression(
        expression: Contracts.Search.Expression<T>,
        sorting: Contracts.Search.Sorting = [],
    ): Promise<T[]> {
        const queryBuilder = this.getFullQueryBuilder();

        this.addWhere(queryBuilder, expression);
        this.addOrderBy(queryBuilder, sorting);

        try {
            return this.toModel(this.model, await queryBuilder.run());
        } catch {
            return [];
        }
    }

    public async listByExpression(
        expression: Contracts.Search.Expression<T>,
        sorting: Contracts.Search.Sorting,
        pagination: Contracts.Search.Pagination,
        count: boolean = true,
    ): Promise<Contracts.Search.ResultsPage<T>> {
        try {
            const queryBuilder = this.getFullQueryBuilder();

            this.addWhere(queryBuilder, expression);
            this.addOrderBy(queryBuilder, sorting);

            queryBuilder.limit(pagination.offset, pagination.limit);
            const results = this.toModel(this.model, await queryBuilder.run());

            let totalCount: number = 0;
            if (count) {
                const totalCountQueryBuilder = this.getFullQueryBuilder().select("COUNT(*)", "count");

                this.addWhere(totalCountQueryBuilder, expression);

                const { count } = (await totalCountQueryBuilder.run())[0];
                totalCount = parseFloat(count);
            }

            return { results, totalCount };
        } catch {
            return { results: [], totalCount: 0 };
        }
    }

    protected getFullQueryBuilder(): Contracts.Database.QueryBuilder {
        return this.createQueryBuilder();
    }

    protected addWhere(
        queryBuilder: Contracts.Database.QueryBuilder,
        expression: Contracts.Search.Expression<T>,
    ): void {
        const sqlExpression = this.getWhereExpressionSql(queryBuilder, expression);
        queryBuilder.where(sqlExpression.query, sqlExpression.parameters);
    }

    protected addOrderBy(queryBuilder: Contracts.Database.QueryBuilder, sorting: Contracts.Search.Sorting): void {
        if (sorting.length) {
            queryBuilder.orderBy(sorting[0].property, sorting[0].direction === "desc" ? "DESC" : "ASC");

            for (const item of sorting.slice(1)) {
                queryBuilder.orderBy(item.property, item.direction === "desc" ? "DESC" : "ASC");
            }
        }
    }

    private getWhereExpressionSql(
        queryBuilder: Contracts.Database.QueryBuilder,
        expression: Contracts.Search.Expression<T>,
        expressions?: Contracts.Search.AndExpression<T>,
    ): { query: string; parameters: Record<string, any> } {
        switch (expression.op) {
            case "true": {
                return { query: "TRUE", parameters: {} };
            }
            case "false": {
                return { query: "FALSE", parameters: {} };
            }
            case "equal": {
                const column = expression.property.toString();
                const param = queryBuilder.addParam(column);
                const query = this.transformQuery(
                    queryBuilder,
                    expression,
                    column,
                    queryBuilder.table,
                    param,
                    expressions,
                    `${column} = :${param}`,
                );
                const parameters = { [param]: expression.value };

                return { query, parameters };
            }
            case "between": {
                const column = expression.property.toString();
                const paramFrom = queryBuilder.addParam(column);
                const paramTo = queryBuilder.addParam(column);
                const query = this.transformQuery(
                    queryBuilder,
                    expression,
                    column,
                    queryBuilder.table,
                    { paramFrom, paramTo },
                    expressions,
                    `${column} BETWEEN :${paramFrom} AND :${paramTo}`,
                );
                const parameters = { [paramFrom]: expression.from, [paramTo]: expression.to };
                return { query, parameters };
            }
            case "greaterThanEqual": {
                const column = expression.property.toString();
                const param = queryBuilder.addParam(column);
                const query = this.transformQuery(
                    queryBuilder,
                    expression,
                    column,
                    queryBuilder.table,
                    param,
                    expressions,
                    `${column} >= :${param}`,
                );
                const parameters = { [param]: expression.value };
                return { query, parameters };
            }
            case "lessThanEqual": {
                const column = expression.property.toString();
                const param = queryBuilder.addParam(column);
                const query = this.transformQuery(
                    queryBuilder,
                    expression,
                    column,
                    queryBuilder.table,
                    param,
                    expressions,
                    `${column} <= :${param}`,
                );
                const parameters = { [param]: expression.value };
                return { query, parameters };
            }
            case "like": {
                const column = expression.property.toString();
                const param = queryBuilder.addParam(column);
                const query = this.transformQuery(
                    queryBuilder,
                    expression,
                    column,
                    queryBuilder.table,
                    param,
                    expressions,
                );
                const parameters = { [param]: expression.pattern };

                return { query, parameters };
            }
            case "amount": {
                const column = expression.op;
                const parameters: Record<string, any> = {};
                if (expression.received !== undefined) {
                    if (typeof expression.received === "number") {
                        parameters.received = expression.received;
                    } else {
                        if (expression.received.from !== undefined) {
                            parameters.receivedFrom = expression.received.from;
                        }
                        if (expression.received.to !== undefined) {
                            parameters.receivedTo = expression.received.to;
                        }
                    }
                }

                if (expression.sent !== undefined) {
                    if (typeof expression.sent === "number") {
                        parameters.sent = expression.sent;
                    } else {
                        if (expression.sent.from !== undefined) {
                            parameters.sentFrom = expression.sent.from;
                        }
                        if (expression.sent.to !== undefined) {
                            parameters.sentTo = expression.sent.to;
                        }
                    }
                }

                const query = this.transformQuery(
                    queryBuilder,
                    expression,
                    column,
                    queryBuilder.table,
                    parameters,
                    expressions,
                );

                return { query, parameters };
            }
            case "vote": {
                const column = expression.op;
                const parameters: Record<string, any> = {};
                if (expression.username !== undefined) {
                    parameters.username = expression.username;
                }

                if (expression.percent !== undefined) {
                    if (typeof expression.percent === "number") {
                        parameters.percent = expression.percent;
                    } else {
                        if (expression.percent.from !== undefined) {
                            parameters.percentFrom = expression.percent.from;
                        }
                        if (expression.percent.to !== undefined) {
                            parameters.percentTo = expression.percent.to;
                        }
                    }
                }

                const query = this.transformQuery(
                    queryBuilder,
                    expression,
                    column,
                    queryBuilder.table,
                    parameters,
                    expressions,
                );

                return { query, parameters };
            }
            case "and": {
                const built = expression.expressions.map((e) =>
                    this.getWhereExpressionSql(queryBuilder, e, expression),
                );
                const query = `(${built.map((b) => b.query).join(" AND ")})`;
                const parameters = built.reduce((acc, b) => Object.assign({}, acc, b.parameters), {});
                return { query, parameters };
            }
            case "or": {
                const built = expression.expressions.map((e) => this.getWhereExpressionSql(queryBuilder, e));
                const query = `(${built.map((b) => b.query).join(" OR ")})`;
                const parameters = built.reduce((acc, b) => Object.assign({}, acc, b.parameters), {});
                return { query, parameters };
            }
            default:
                throw new Error("Unexpected expression");
        }
    }

    private transformQuery(
        queryBuilder: Contracts.Database.QueryBuilder,
        expression: Contracts.Search.Expression<T>,
        column: string,
        table: string,
        param: string | Record<string, any>,
        andExpressions?: Contracts.Search.AndExpression<T>,
        query?: string,
    ): string {
        switch (column) {
            case "generatorPublicKey":
            case "senderPublicKey":
                return `${table}.public_key_id = (SELECT id FROM public_keys WHERE public_keys.public_key = :${param} LIMIT 1)`;
            case "previousBlock":
                return `${table}.previous_block_height = (SELECT height FROM blocks WHERE blocks.id = :${param} LIMIT 1)`;
            case "senderId":
                return `${table}.identity_id = (SELECT id FROM identities WHERE identities.identity = :${param} LIMIT 1)`;
            case "username": {
                switch (table) {
                    case "blocks": {
                        return `blocks.identity_id = (SELECT id FROM identities WHERE identities.identity = :${param} AND identities.is_username = 1 LIMIT 1)`;
                    }
                    case "transactions": {
                        return `transactions.row = (SELECT transactions_row FROM transactions_registration WHERE transactions_registration.identity_id = (SELECT id FROM identities WHERE identities.identity = :${param} LIMIT 1) LIMIT 1)`;
                    }
                }
                break;
            }
            case "type": {
                return `${table}.type_id = (SELECT id FROM types WHERE types.type = :${param} LIMIT 1)`;
            }
            case "id": {
                const idExpression = expression as Contracts.Search.LikeExpression<T>;
                if (idExpression.pattern.length === 65 || !idExpression.pattern.endsWith("*")) {
                    if (idExpression.pattern.length === 65) {
                        idExpression.pattern = idExpression.pattern.slice(0, 64);
                    }
                    return `${table}.id = :${param}`;
                } else if (idExpression.pattern.endsWith("*")) {
                    switch (table) {
                        case "blocks": {
                            return `${table}.height IN (SELECT rowid FROM blocks_id_fts WHERE id MATCH :${param})`;
                        }
                        case "transactions": {
                            return `${table}.row IN (SELECT rowid FROM transactions_id_fts WHERE id MATCH :${param})`;
                        }
                        default: {
                            throw new Error("FTS is only available for id column on blocks and transactions tables");
                        }
                    }
                }
                break;
            }
            case "memo": {
                const memoExpression = expression as Contracts.Search.LikeExpression<T>;
                if (memoExpression.pattern.length >= 3) {
                    return `
                        transactions.row IN (
                            SELECT rowid FROM transactions_memo_fts
                            WHERE transactions_memo_fts.memo MATCH :${param}
                            UNION SELECT transactions_row FROM balance_changes
                            WHERE balance_changes.row IN (
                                SELECT rowid FROM balance_changes_local_memo_fts
                                WHERE balance_changes_local_memo_fts.local_memo MATCH :${param}
                            )
                        )`;
                } else {
                    return `
                        transactions.memo = :${param} OR
                        transactions.row IN (
                            SELECT transactions_row FROM balance_changes
                            WHERE local_memo = :${param}
                        )`;
                }
            }
            case "amount": {
                const { received, sent } = expression as Contracts.Search.AmountExpression<T>;
                const amountExpressions: string[] = [];

                if (typeof received === "number") {
                    amountExpressions.push("balance_changes.amount_received = :received");
                }
                if (typeof sent === "number") {
                    amountExpressions.push("balance_changes.amount_sent = :sent");
                }

                if (received?.from !== undefined && received?.to === undefined) {
                    amountExpressions.push("balance_changes.amount_received >= :receivedFrom");
                }
                if (sent?.from !== undefined && sent?.to === undefined) {
                    amountExpressions.push("balance_changes.amount_sent >= :sentFrom");
                }

                if (received?.to !== undefined && received?.from === undefined) {
                    amountExpressions.push("balance_changes.amount_received <= :receivedTo");
                }
                if (sent?.to !== undefined && sent?.from === undefined) {
                    amountExpressions.push("balance_changes.amount_sent <= :sentTo");
                }

                if (received?.from !== undefined && received?.to !== undefined) {
                    amountExpressions.push("balance_changes.amount_received BETWEEN :receivedFrom AND :receivedTo");
                }
                if (sent?.from !== undefined && sent?.to !== undefined) {
                    amountExpressions.push("balance_changes.amount_sent BETWEEN :sentFrom AND :sentTo");
                }

                if (andExpressions) {
                    const { expressions } = andExpressions!;
                    if (expressions) {
                        const recipientExpression = expressions.find(
                            (expression) =>
                                (expression as Contracts.Search.EqualExpression<T>).property === "recipientId",
                        );
                        if (recipientExpression) {
                            amountExpressions.push(
                                "balance_changes.identity_id = (SELECT id FROM identities WHERE identities.identity = :recipientId LIMIT 1)",
                            );
                        }
                    }
                }
                return `EXISTS (SELECT transactions_row FROM balance_changes WHERE balance_changes.transactions_row = transactions.row AND (${amountExpressions.join(
                    " AND ",
                )}))`;
            }
            case "recipientId": {
                if (andExpressions) {
                    const { expressions } = andExpressions!;
                    if (expressions) {
                        const amountExpression = expressions.find(
                            (expression) => (expression as Contracts.Search.EqualExpression<T>).property === "amount",
                        );
                        if (amountExpression) {
                            return "TRUE";
                        }
                    }
                }
                return `transactions.row IN (SELECT transactions_row FROM balance_changes WHERE balance_changes.identity_id = (SELECT id FROM identities WHERE identities.identity = :${param} LIMIT 1))`;
            }
            case "hash": {
                return `transactions.row = (SELECT transactions_row FROM transactions_ipfs WHERE transactions_ipfs.hash = :${param} LIMIT 1)`;
            }
            case "resignation": {
                let enumValue: number;
                switch ((expression as Contracts.Search.EqualExpression<T>).value) {
                    case "temporary": {
                        enumValue = Enums.DelegateStatus.TemporaryResign;
                        break;
                    }
                    case "permanent": {
                        enumValue = Enums.DelegateStatus.PermanentResign;
                        break;
                    }
                    default: {
                        enumValue = Enums.DelegateStatus.NotResigned;
                    }
                }

                return `transactions.row IN (SELECT transactions_row FROM transactions_resignation WHERE transactions_resignation.resignation_type = ${enumValue})`;
            }
            case "signature": {
                return `transactions.row = (SELECT transactions_row FROM transactions_extra_signature WHERE transactions_extra_signature.public_key_id = (SELECT id FROM public_keys WHERE public_keys.public_key = :${param} LIMIT 1) LIMIT 1)`;
            }
            case "vote": {
                queryBuilder.crossJoin("transactions_vote", "transactions_vote.transactions_row = transactions.row");
                const { username, percent } = expression as Contracts.Search.VoteExpression<T>;
                const idQuery =
                    "transactions_vote.identity_id = (SELECT id FROM identities WHERE identities.identity = :username AND is_username = 1 LIMIT 1)";
                const equalPercentQuery = "percent = :percent";
                const greaterThanEqualPercentQuery = "percent >= :percentFrom";
                const lessThanEqualPercentQuery = "percent <= :percentTo";
                const betweenPercentQuery = "percent BETWEEN :percentFrom AND :percentTo";

                if (username !== undefined && percent === undefined) {
                    return idQuery;
                } else if (percent !== undefined && typeof percent === "number" && username === undefined) {
                    return equalPercentQuery;
                } else if (percent?.from !== undefined && percent?.to === undefined && username === undefined) {
                    return greaterThanEqualPercentQuery;
                } else if (percent?.to !== undefined && percent?.from === undefined && username === undefined) {
                    return lessThanEqualPercentQuery;
                } else if (percent?.from !== undefined && percent?.to !== undefined && username === undefined) {
                    return betweenPercentQuery;
                } else if (percent !== undefined && typeof percent === "number" && username !== undefined) {
                    return `(${idQuery} AND ${equalPercentQuery})`;
                } else if (percent?.from !== undefined && username !== undefined && percent?.to === undefined) {
                    return `(${idQuery} AND ${greaterThanEqualPercentQuery})`;
                } else if (percent?.to !== undefined && username !== undefined && percent?.from === undefined) {
                    return `(${idQuery} AND ${lessThanEqualPercentQuery})`;
                } else if (percent?.from !== undefined && username !== undefined && percent?.to !== undefined) {
                    return `(${idQuery} AND ${betweenPercentQuery})`;
                }
                break;
            }
        }
        return query!;
    }
}
