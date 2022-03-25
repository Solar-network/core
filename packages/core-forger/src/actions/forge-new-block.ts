import { Contracts, Services, Types } from "@solar-network/core-kernel";

import { ForgerService } from "../forger-service";
import { Delegate } from "../interfaces";

export class ForgeNewBlockAction extends Services.Triggers.Action {
    public async execute(args: Types.ActionArguments): Promise<void> {
        const forgerService: ForgerService = args.forgerService;
        const delegate: Delegate = args.delegate;
        const firstAttempt: boolean = args.firstAttempt;
        const round: Contracts.P2P.CurrentRound = args.round;

        return forgerService.forgeNewBlock(delegate, firstAttempt, round);
    }
}
