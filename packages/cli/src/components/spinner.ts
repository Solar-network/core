import ora, { Options, Ora } from "@alessiodf/ora";

import { injectable } from "../ioc";

/**
 * @export
 * @class Spinner
 */
@injectable()
export class Spinner {
    /**
     * @static
     * @param {(string | Options | undefined)} [options]
     * @returns {Ora}
     * @memberof Spinner
     */

    private ora!: Ora;
    public get(): Ora {
        return this.ora;
    }
    public render(options?: string | Options | undefined): Ora {
        this.ora = ora(options);
        return this.ora;
    }
}
