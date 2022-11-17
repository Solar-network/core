import { Ajv } from "ajv";

const memo = (ajv: Ajv): void => {
    ajv.addFormat("memo", (data) => {
        try {
            const buf = Buffer.from(data, "utf8");
            return buf.length <= 255 && !buf.includes(Buffer.from("00", "hex"));
        } catch {
            return false;
        }
    });
};

export const formats = [memo];
