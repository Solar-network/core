import { configManager } from "../managers/config";

const getActiveDelegates = (height: number): number => {
    const milestones = configManager.get("milestones");

    for (let i = milestones.length - 1; i >= 0; i--) {
        const milestone = milestones[i];
        if (milestone.height <= height) {
            if (milestone.activeDelegates) {
                return milestone.activeDelegates;
            }
        }
    }

    throw new Error("No milestones specifying any height were found");
};

const getReward = (height: number): number => {
    const milestones = configManager.get("milestones");

    for (let i = milestones.length - 1; i >= 0; i--) {
        const milestone = milestones[i];
        if (milestone.height <= height) {
            if (milestone.reward) {
                return milestone.reward;
            }
        }
    }

    return 0;
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

export const calculateReward = (height: number, rank: number): number => {
    const activeDelegates = getActiveDelegates(height);
    const dynamicReward = getDynamicReward(height);
    const reward = getReward(height);

    if (dynamicReward.enabled) {
        let sum = 0;
        for (let i = 1; i <= activeDelegates; i++) {
            sum += (i + dynamicReward.variableRatio) / activeDelegates;
        }

        return Math.round(
            ((rank + dynamicReward.variableRatio) / activeDelegates) * ((reward / sum) * activeDelegates),
        );
    } else {
        return reward;
    }
};
