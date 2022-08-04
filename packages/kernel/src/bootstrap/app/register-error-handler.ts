import logProcessErrors from "log-process-errors";

import { injectable } from "../../ioc";
import { Bootstrapper } from "../interfaces";

/**
 * @export
 * @class RegisterErrorHandler
 * @implements {Bootstrapper}
 */
@injectable()
export class RegisterErrorHandler implements Bootstrapper {
    /**
     * @returns {Promise<void>}
     * @memberof RegisterErrorHandler
     */
    public async bootstrap(): Promise<void> {
        logProcessErrors({ exitOn: [] });
    }
}
