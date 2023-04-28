import * as Schemas from "../schemas";

export const missedBlockSortingSchema = Schemas.createSortingSchema(Schemas.missedBlockCriteriaSchemas, [], false);

export const missedBlockSortingSchemaWithoutUsername = Schemas.createSortingSchema(
    Schemas.missedBlockCriteriaSchemasWithoutUsername,
    [],
    false,
);

export const missedBlockQueryLevelOptions = [
    { field: "timestamp", asc: true, desc: true, allowSecondOrderBy: true, diverse: true },
    { field: "height", asc: true, desc: true, allowSecondOrderBy: true, diverse: true },
    { field: "username", asc: true, desc: true, allowSecondOrderBy: true, diverse: true },
];
