// Based on https://github.com/fknop/hapi-pagination

import Joi from "joi";

export const getConfig = (options: object): { error: Joi.ValidationError | undefined; config: any } => {
    const { error, value } = Joi.object({
        query: Joi.object({
            limit: Joi.object({
                default: Joi.number().integer().positive().default(100),
            }),
        }),
    }).validate(options);

    /* istanbul ignore next */
    return { error: error || undefined, config: error ? undefined : value };
};
