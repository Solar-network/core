import { Container, Contracts, Services, Types } from "@solar-network/kernel";

import { RoundState } from "../round-state";

export class GetActiveDelegatesAction extends Services.Triggers.Action {
    private app: Contracts.Kernel.Application;

    public constructor(app: Contracts.Kernel.Application) {
        super();
        this.app = app;
    }

    public async execute(args: Types.ActionArguments): Promise<Contracts.State.Wallet[]> {
        const roundInfo: Contracts.Shared.RoundInfo = args.roundInfo;
        const delegates: Contracts.State.Wallet[] = args.delegates;

        return this.app.get<RoundState>(Container.Identifiers.RoundState).getActiveDelegates(roundInfo, delegates);
    }
}
