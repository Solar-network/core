import Joi from "joi";

export const headers = Joi.object({
    version: Joi.string(),
    port: Joi.number().min(0).max(65535),
});
