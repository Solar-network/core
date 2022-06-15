import { Container, Providers, Services } from "@solar-network/core-kernel";

import { Core, Solar, TransactionHandlerConstructor } from "./handlers";
import { TransactionHandlerProvider } from "./handlers/handler-provider";
import { TransactionHandlerRegistry } from "./handlers/handler-registry";

export class ServiceProvider extends Providers.ServiceProvider {
    public static getTransactionHandlerConstructorsBinding(): (
        context: Container.interfaces.Context,
    ) => TransactionHandlerConstructor[] {
        return (context: Container.interfaces.Context) => {
            type BindingDictionary = Container.interfaces.Lookup<Container.interfaces.Binding<unknown>>;
            const handlerConstructors: TransactionHandlerConstructor[] = [];
            let container: Container.interfaces.Container | null = context.container;

            do {
                const bindingDictionary = container["_bindingDictionary"] as BindingDictionary;
                const handlerBindings = bindingDictionary.getMap().get(Container.Identifiers.TransactionHandler) ?? [];

                for (const handlerBinding of handlerBindings) {
                    if (handlerBinding.implementationType) {
                        handlerConstructors.push(handlerBinding.implementationType as TransactionHandlerConstructor);
                    }
                }

                container = container.parent;
            } while (container);

            return handlerConstructors;
        };
    }

    /**
     * @returns {Promise<void>}
     * @memberof ServiceProvider
     */
    public async register(): Promise<void> {
        this.app
            .bind<Services.Attributes.AttributeSet>(Container.Identifiers.WalletAttributes)
            .to(Services.Attributes.AttributeSet)
            .inSingletonScope();

        this.app
            .bind(Container.Identifiers.TransactionHandlerProvider)
            .to(TransactionHandlerProvider)
            .inSingletonScope();

        this.app
            .bind(Container.Identifiers.WalletRepository)
            .toConstantValue(null)
            .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("state", "null"));

        // Core transactions
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.LegacyTransferTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.SecondSignatureRegistrationTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.DelegateRegistrationTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.LegacyVoteTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.MultiSignatureRegistrationTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.IpfsTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.TransferTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.DelegateResignationTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.HtlcLockTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.HtlcClaimTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Core.HtlcRefundTransactionHandler);

        // Solar transactions
        this.app.bind(Container.Identifiers.TransactionHandler).to(Solar.BurnTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(Solar.VoteTransactionHandler);

        this.app
            .bind(Container.Identifiers.TransactionHandlerConstructors)
            .toDynamicValue(ServiceProvider.getTransactionHandlerConstructorsBinding());

        this.app.bind(Container.Identifiers.TransactionHandlerRegistry).to(TransactionHandlerRegistry);
    }

    /**
     * @returns {Promise<boolean>}
     * @memberof ServiceProvider
     */
    public async required(): Promise<boolean> {
        return true;
    }
}
