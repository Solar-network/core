import { Ajv } from "ajv";

import { isValidPeer, maxVendorFieldLength } from "../utils";

const vendorField = (ajv: Ajv): void => {
    ajv.addFormat("vendorField", (data) => {
        try {
            return Buffer.from(data, "utf8").length <= maxVendorFieldLength();
        } catch {
            return false;
        }
    });
};

const validPeer = (ajv: Ajv): void => {
    ajv.addFormat("peer", (ip: string) => {
        try {
            return isValidPeer({ ip }, false);
        } catch {
            return false;
        }
    });
};

export const formats = [vendorField, validPeer];
