import { Validation } from "@solar-network/crypto";

import { SocketErrors } from "../../enums";

export const validate = (schema: string | boolean | object, data: object): void => {
    const { error: validationError } = Validation.validator.validate(schema, data);

    if (validationError) {
        const error = new Error(`Data validation error : ${validationError}`);
        error.name = SocketErrors.Validation;

        throw error;
    }
};
