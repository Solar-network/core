import * as Schemas from "../schemas";

export const blockProductionFailureSortingSchema = Schemas.createSortingSchema(
    Schemas.blockProductionFailureCriteriaSchemas,
    [],
    false,
);
