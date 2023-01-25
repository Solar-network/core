import { Services, Types } from "@solar-network/kernel";

import { DposState } from "../dpos";

export class BuildBlockProducerRankingAction extends Services.Triggers.Action {
    public async execute(args: Types.ActionArguments): Promise<void> {
        const dposState: DposState = args.dposState;

        return dposState.buildBlockProducerRanking();
    }
}
