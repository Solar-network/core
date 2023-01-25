import { Crypto, Managers } from "@solar-network/crypto";

import { BlockProductionInfo } from "../contracts/shared";

export interface MilestoneSearchResult {
    found: boolean;
    height: number;
    data: any;
}

export const getMilestonesWhichAffectActiveBlockProducerCount = (): Array<MilestoneSearchResult> => {
    const milestones: Array<MilestoneSearchResult> = [
        {
            found: true,
            height: 1,
            data: Managers.configManager.getMilestone(1).activeBlockProducers,
        },
    ];

    let nextMilestone = Managers.configManager.getNextMilestoneWithNewKey(1, "activeBlockProducers");

    while (nextMilestone.found) {
        milestones.push(nextMilestone);
        nextMilestone = Managers.configManager.getNextMilestoneWithNewKey(nextMilestone.height, "activeBlockProducers");
    }

    return milestones;
};

export const calculateBlockProductionInfo = (
    timestamp: number,
    height: number,
    getTimeStampForBlock: (blockHeight: number) => number,
): BlockProductionInfo => {
    const slotInfo = Crypto.Slots.getSlotInfo(getTimeStampForBlock, timestamp, height);

    const [currentBlockProducer, nextBlockProducer] = findIndex(height, slotInfo.slotNumber, getTimeStampForBlock);
    const canProduceBlock = slotInfo.status;

    return { currentBlockProducer, nextBlockProducer, blockTimestamp: slotInfo.startTime, canProduceBlock };
};

const findIndex = (
    height: number,
    slotNumber: number,
    getTimeStampForBlock: (blockHeight: number) => number,
): [number, number] => {
    let nextMilestone = Managers.configManager.getNextMilestoneWithNewKey(1, "activeBlockProducers");

    let lastSpanSlotNumber = 0;
    let activeBlockProducers = Managers.configManager.getMilestone(1).activeBlockProducers;

    const milestones = getMilestonesWhichAffectActiveBlockProducerCount();

    for (let i = 0; i < milestones.length - 1; i++) {
        if (height < nextMilestone.height) {
            break;
        }

        const lastSpanEndTime = getTimeStampForBlock(nextMilestone.height - 1);
        lastSpanSlotNumber =
            Crypto.Slots.getSlotInfo(getTimeStampForBlock, lastSpanEndTime, nextMilestone.height - 1).slotNumber + 1;
        activeBlockProducers = nextMilestone.data;

        nextMilestone = Managers.configManager.getNextMilestoneWithNewKey(nextMilestone.height, "activeBlockProducers");
    }

    const currentBlockProducer = (slotNumber - lastSpanSlotNumber) % activeBlockProducers;
    const nextBlockProducer = (currentBlockProducer + 1) % activeBlockProducers;

    return [currentBlockProducer, nextBlockProducer];
};
