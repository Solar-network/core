import { existsSync } from "fs-extra";
import { join } from "path";

import { KeysNotDetected, MissingConfigFile } from "../exceptions/crypto";

export const checkForPassphrase = (config?: string): void => {
    if (!config && process.env.CORE_PATH_CONFIG) {
        config = process.env.CORE_PATH_CONFIG;
    }

    const configDelegates = join(config!, "delegates.json");

    if (!existsSync(configDelegates)) {
        throw new MissingConfigFile(configDelegates);
    }

    const delegates = require(configDelegates);

    if (!delegates.keys?.length && !delegates.secrets?.length) {
        throw new KeysNotDetected();
    }
};
