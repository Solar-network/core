import { Container, Contracts } from "@solar-network/kernel";

import { actions } from "./actions";
import { Action } from "./contracts";
import { blockchainMachine } from "./machine";

@Container.injectable()
export class StateMachine {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    /**
     * Dispatch an event to transition the state machine.
     *
     * @param  {String} event
     * @return {void}
     */
    public transition(event: string): void {
        const nextState = blockchainMachine.transition(this.stateStore.getBlockchain(), event);

        if (!nextState.changed) {
            return;
        }

        if (nextState.actions.length > 0) {
            this.logger.debug(
                `event '${event}': ${JSON.stringify(this.stateStore.getBlockchain().value)} -> ${JSON.stringify(
                    nextState.value,
                )} -> actions: [${nextState.actions.map((a) => a.type).join(", ")}]`,
            );
        } else {
            this.logger.debug(
                `event '${event}': ${JSON.stringify(this.stateStore.getBlockchain().value)} -> ${JSON.stringify(
                    nextState.value,
                )}`,
            );
        }

        this.stateStore.setBlockchain(nextState);

        for (const actionKey of nextState.actions.map((action) => action.type)) {
            let action: Action = undefined as unknown as Action;
            try {
                action = this.app.resolve(actions[actionKey]);
            } catch {
                //
            }

            if (action) {
                setImmediate(() => action.handle());
            } else {
                this.logger.error(`No action '${actionKey}' found :interrobang:`);
            }
        }

        return nextState;
    }

    public getState(): string | undefined {
        return this.stateStore.getBlockchain().value;
    }
}
