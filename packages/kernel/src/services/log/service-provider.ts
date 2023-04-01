import { Identifiers, interfaces } from "../../ioc";
import { ServiceProvider as BaseServiceProvider } from "../../providers";
import { NotTaggedError } from "./errors";
import { LogManager } from "./manager";

export class ServiceProvider extends BaseServiceProvider {
    /**
     * Register the service provider.
     *
     * @returns {Promise<void>}
     * @memberof ServiceProvider
     */
    public async register(): Promise<void> {
        this.app.bind<LogManager>(Identifiers.LogManager).to(LogManager).inSingletonScope();
        await this.app.get<LogManager>(Identifiers.LogManager).boot();

        this.app.bind(Identifiers.LogService).toDynamicValue((context: interfaces.Context) => {
            const tag = context.currentRequest.target.metadata.find(({ key }) => key === "package")?.value;
            const driver = context.container.get<LogManager>(Identifiers.LogManager).driver();

            if (!tag) {
                throw new NotTaggedError();
            }

            return {
                critical: (message: object | string | undefined, emoji?: string) => {
                    driver.critical(message, emoji, tag);
                },
                error: (message: object | string | undefined, emoji?: string) => {
                    driver.error(message, emoji, tag);
                },
                warning: (message: object | string | undefined, emoji?: string) => {
                    driver.warning(message, emoji, tag);
                },
                info: (message: object | string | undefined, emoji?: string) => {
                    driver.info(message, emoji, tag);
                },
                debug: (message: object | string | undefined, emoji?: string) => {
                    driver.debug(message, emoji, tag);
                },
                trace: (message: object | string | undefined, emoji?: string) => {
                    driver.trace(message, emoji, tag);
                },
            };
        });
    }
}
