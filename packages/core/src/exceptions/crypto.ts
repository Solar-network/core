import { Exception } from "./base";

export class MissingConfigFile extends Exception {
    public constructor(filePath: string) {
        super(`The ${filePath} file does not exist.`);
    }
}

export class PassphraseNotDetected extends Exception {
    public constructor() {
        super(`We were unable to detect a BIP39 passphrase.`);
    }
}
