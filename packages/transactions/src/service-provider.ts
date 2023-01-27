import { Container, Providers, Services } from "@solar-network/kernel";

import {
    BurnTransactionHandler,
    ExtraSignatureRegistrationTransactionHandler,
    IpfsTransactionHandler,
    RegistrationTransactionHandler,
    ResignationTransactionHandler,
    TransactionHandlerConstructor,
    TransferTransactionHandler,
    UpgradeTransactionHandler,
    VoteTransactionHandler,
} from "./handlers";
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

        this.app.bind(Container.Identifiers.TransactionHandler).to(BurnTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(RegistrationTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(ResignationTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(ExtraSignatureRegistrationTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(IpfsTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(TransferTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(UpgradeTransactionHandler);
        this.app.bind(Container.Identifiers.TransactionHandler).to(VoteTransactionHandler);

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
