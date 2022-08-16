import * as Schemas from "../schemas";

export const missedBlockSortingSchema = Schemas.createSortingSchema(Schemas.missedBlockCriteriaSchemas, [], false);

export const missedBlockSortingSchemaWithoutUsername = Schemas.createSortingSchema(
    Schemas.missedBlockCriteriaSchemasWithoutUsername,
    [],
    false,
);
