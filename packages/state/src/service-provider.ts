import { Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Providers, Services } from "@solar-network/kernel";
import Joi from "joi";

import { BuildDelegateRankingAction, GetActiveDelegatesAction } from "./actions";
import { BlockState } from "./block-state";
import { DatabaseInteraction } from "./database-interactions";
import { DatabaseInterceptor } from "./database-interceptor";
import { DposPreviousRoundState, DposState } from "./dpos";
import { RoundState } from "./round-state";
import { StateBuilder } from "./state-builder";
import { StateLoader } from "./state-loader";
import { StateSaver } from "./state-saver";
import { BlockStore } from "./stores/blocks";
import { StateStore } from "./stores/state";
import { TransactionStore } from "./stores/transactions";
import { TransactionValidator } from "./transaction-validator";
import { WalletRepository, WalletRepositoryClone, WalletRepositoryCopyOnWrite } from "./wallets";
import { registerIndexers } from "./wallets/indexers";
import { walletFactory } from "./wallets/wallet-factory";

export const dposPreviousRoundStateProvider = (context: Container.interfaces.Context) => {
    return async (
        blocks: Interfaces.IBlock[],
        roundInfo: Contracts.Shared.RoundInfo,
    ): Promise<Contracts.State.DposPreviousRoundState> => {
        const previousRound = context.container.resolve(DposPreviousRoundState);
        await previousRound.revert(blocks, roundInfo);
        return previousRound;
    };
};

export class ServiceProvider extends Providers.ServiceProvider {
    public async register(): Promise<void> {
        registerIndexers(this.app);

        this.app
            .bind(Container.Identifiers.WalletRepository)
            .to(WalletRepository)
            .inSingletonScope()
            .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("state", "blockchain"));

        this.app
            .bind(Container.Identifiers.WalletFactory)
            .toFactory(({ container }) => {
                return walletFactory(
                    container.get(Container.Identifiers.WalletAttributes),
                    container.get(Container.Identifiers.EventDispatcherService),
                );
            })
            .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("state", "blockchain"));

        this.app
            .bind(Container.Identifiers.WalletRepository)
            .to(WalletRepositoryClone)
            .inRequestScope()
            .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("state", "clone"));

        this.app
            .bind(Container.Identifiers.WalletFactory)
            .toFactory(({ container }) => {
                return walletFactory(container.get(Container.Identifiers.WalletAttributes));
            })
            .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("state", "clone"));

        this.app
            .bind(Container.Identifiers.WalletRepository)
            .to(WalletRepositoryCopyOnWrite)
            .inRequestScope()
            .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("state", "copy-on-write"));

        this.app
            .bind(Container.Identifiers.WalletFactory)
            .toFactory(({ container }) => {
                return walletFactory(container.get(Container.Identifiers.WalletAttributes));
            })
            .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("state", "copy-on-write"));

        this.app.bind(Container.Identifiers.DposState).to(DposState);
        this.app.bind(Container.Identifiers.BlockState).to(BlockState);
        this.app.bind(Container.Identifiers.RoundState).to(RoundState).inSingletonScope();

        this.app.bind(Container.Identifiers.StateBlockStore).toConstantValue(new BlockStore(1000));
        this.app.bind(Container.Identifiers.StateTransactionStore).toConstantValue(new TransactionStore(1000));

        this.app.bind(Container.Identifiers.StateStore).to(StateStore).inSingletonScope();

        this.app
            .bind<Contracts.State.DposPreviousRoundStateProvider>(Container.Identifiers.DposPreviousRoundStateProvider)
            .toProvider(dposPreviousRoundStateProvider);

        this.app.bind(Container.Identifiers.TransactionValidator).to(TransactionValidator);

        this.app
            .bind(Container.Identifiers.TransactionValidatorFactory)
            .toAutoFactory(Container.Identifiers.TransactionValidator);

        this.app.bind(Container.Identifiers.DatabaseInteraction).to(DatabaseInteraction).inSingletonScope();
        this.app.bind(Container.Identifiers.DatabaseInterceptor).to(DatabaseInterceptor).inSingletonScope();

        this.app.bind(Container.Identifiers.StateBuilder).to(StateBuilder);
        this.app.bind(Container.Identifiers.StateLoader).to(StateLoader);
        this.app.bind(Container.Identifiers.StateSaver).to(StateSaver);

        this.registerActions();
    }

    public async boot(): Promise<void> {
        await this.app.get<DatabaseInteraction>(Container.Identifiers.DatabaseInteraction).initialise();
    }

    public async bootWhen(serviceProvider?: string): Promise<boolean> {
        return serviceProvider === "@solar-network/database";
    }

    public configSchema(): object {
        return Joi.object({
            storage: Joi.object({
                maxLastBlocks: Joi.number().integer().min(1).required(),
                maxLastTransactionIds: Joi.number().integer().min(1).required(),
            }).required(),
            walletSync: Joi.object({
                enabled: Joi.boolean().required(),
            }).required(),
        }).unknown(true);
    }

    private registerActions(): void {
        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("buildDelegateRanking", new BuildDelegateRankingAction());

        this.app
            .get<Services.Triggers.Triggers>(Container.Identifiers.TriggerService)
            .bind("getActiveDelegates", new GetActiveDelegatesAction(this.app));
    }
}
