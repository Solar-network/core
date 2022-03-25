import { configManager } from "../managers/config";
import { BigNumber } from "./bignum";

const getReward = (height: number): BigNumber => {
    const milestones = configManager.get("milestones");

    for (let i = milestones.length - 1; i >= 0; i--) {
        const milestone = milestones[i];
        if (milestone.height <= height) {
            if (milestone.reward) {
                return BigNumber.make(milestone.reward);
            }
        }
    }

    return BigNumber.ZERO;
};

const getDynamicReward = (height: number) => {
    const milestones = configManager.get("milestones");

    for (let i = milestones.length - 1; i >= 0; i--) {
        const milestone = milestones[i];
        if (milestone.height <= height) {
            if (milestone.dynamicReward) {
                return milestone.dynamicReward;
            }
        }
    }

    return {};
};

export const calculateReward = (height: number, rank: number): BigNumber => {
    const dynamicReward = getDynamicReward(height);
    const reward = getReward(height);

    if (dynamicReward.enabled) {
        if (typeof dynamicReward.ranks === "object" && typeof dynamicReward.ranks[rank] !== "undefined") {
            return dynamicReward.ranks[rank];
        }

        throw new Error(`No dynamic reward configured for rank ${rank}`);
    } else {
        return reward;
    }
};
