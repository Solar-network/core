import { existsSync } from "fs-extra";
import { join } from "path";

import { KeysNotDetected, MissingConfigFile } from "../exceptions/crypto";

export const checkForPrivateKeys = (config?: string): void => {
    if (!config && process.env.SOLAR_CORE_PATH_CONFIG) {
        config = process.env.SOLAR_CORE_PATH_CONFIG;
    }

    const configBlockProducers = join(config!, "producer.json");

    if (!existsSync(configBlockProducers)) {
        throw new MissingConfigFile(configBlockProducers);
    }

    const blockProducers = require(configBlockProducers);

    if (!blockProducers.keys?.length && !blockProducers.secrets?.length) {
        throw new KeysNotDetected();
    }
};
