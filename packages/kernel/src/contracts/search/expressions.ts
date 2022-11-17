export type TrueExpression = {
    op: "true";
};

export type FalseExpression = {
    op: "false";
};

export type EqualExpression<TEntity> = {
    property: string | keyof TEntity;
    op: "equal";
    value: any;
};

export type BetweenExpression<TEntity> = {
    property: string | keyof TEntity;
    op: "between";
    from: any;
    to: any;
};

export type GreaterThanEqualExpression<TEntity> = {
    property: string | keyof TEntity;
    op: "greaterThanEqual";
    value: any;
};

export type LessThanEqualExpression<TEntity> = {
    property: string | keyof TEntity;
    op: "lessThanEqual";
    value: any;
};

export type LikeExpression<TEntity> = {
    property: string | keyof TEntity;
    op: "like";
    pattern: any;
};

export type AndExpression<TEntity> = {
    op: "and";
    expressions: Expression<TEntity>[];
};

export type OrExpression<TEntity> = {
    op: "or";
    expressions: Expression<TEntity>[];
};

export type VoteExpression<TEntity> = {
    op: "vote";
    percent: any;
    username: any;
};

export type AmountExpression<TEntity> = {
    op: "amount";
    received: any;
    sent: any;
};

export type Expression<TEntity> =
    | TrueExpression
    | FalseExpression
    | EqualExpression<TEntity>
    | BetweenExpression<TEntity>
    | GreaterThanEqualExpression<TEntity>
    | LessThanEqualExpression<TEntity>
    | LikeExpression<TEntity>
    | AndExpression<TEntity>
    | OrExpression<TEntity>
    | VoteExpression<TEntity>
    | AmountExpression<TEntity>;
