import { Errors, Managers } from "@solar-network/crypto";

import { RoundInfo } from "../contracts/shared";
import { getMilestonesWhichAffectActiveBlockProducerCount } from "./calculate-block-production-info";

export const isNewRound = (height: number): boolean => {
    const milestones = Managers.configManager.get("milestones");

    let milestone;
    for (let i = milestones.length - 1; i >= 0; i--) {
        const temp = milestones[i];
        if (temp.height > height) {
            continue;
        }

        if (!milestone || temp.activeBlockProducers === milestone.activeBlockProducers) {
            milestone = temp;
        } else {
            break;
        }
    }

    return height === 1 || (height - milestone.height) % milestone.activeBlockProducers === 0;
};

export const calculateRound = (height: number): RoundInfo => {
    const result: RoundInfo = {
        round: 1,
        roundHeight: 1,
        nextRound: 0,
        maxBlockProducers: 0,
    };

    let nextMilestone = Managers.configManager.getNextMilestoneWithNewKey(1, "activeBlockProducers");
    let activeBlockProducers = Managers.configManager.getMilestone(1).activeBlockProducers;
    let milestoneHeight = 1;

    const milestones = getMilestonesWhichAffectActiveBlockProducerCount();

    for (let i = 0; i < milestones.length - 1; i++) {
        if (height < nextMilestone.height) {
            break;
        }

        const spanHeight = nextMilestone.height - milestoneHeight;
        if (spanHeight % activeBlockProducers !== 0) {
            throw new Errors.InvalidMilestoneConfigurationError(
                `Bad milestone at height: ${height}. The number of block producers can only be changed at the beginning of a new round`,
            );
        }

        result.round += spanHeight / activeBlockProducers;
        result.roundHeight = nextMilestone.height;
        result.maxBlockProducers = nextMilestone.data;

        activeBlockProducers = nextMilestone.data;
        milestoneHeight = nextMilestone.height;

        nextMilestone = Managers.configManager.getNextMilestoneWithNewKey(nextMilestone.height, "activeBlockProducers");
    }

    const heightFromLastSpan = height - milestoneHeight;
    const roundIncrease = Math.floor(heightFromLastSpan / activeBlockProducers);
    const nextRoundIncrease = (heightFromLastSpan + 1) % activeBlockProducers === 0 ? 1 : 0;

    result.round += roundIncrease;
    result.roundHeight += roundIncrease * activeBlockProducers;
    result.nextRound = result.round + nextRoundIncrease;
    result.maxBlockProducers = activeBlockProducers;

    return result;
};
