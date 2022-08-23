import { Ajv } from "ajv";

const memo = (ajv: Ajv): void => {
    ajv.addFormat("memo", (data) => {
        try {
            return Buffer.from(data, "utf8").length <= 255;
        } catch {
            return false;
        }
    });
};

export const formats = [memo];
