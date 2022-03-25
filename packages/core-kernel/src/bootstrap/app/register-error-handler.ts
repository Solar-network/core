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
        /* eslint-disable @typescript-eslint/no-implied-eval */
        const _importDynamic = new Function("modulePath", "return import(modulePath)");
        const logProcessErrors = await _importDynamic("log-process-errors");
        logProcessErrors.default({ exitOn: [] });
    }
}
