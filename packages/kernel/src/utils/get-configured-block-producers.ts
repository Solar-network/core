import { readJsonSync } from "fs-extra";

export const getConfiguredBlockProducers = (): string[] => {
    return sendSignal(0);
};

export const sendSignal = (signal: string | number): string[] => {
    try {
        const { pid, publicKeys } = readJsonSync(`${process.env.SOLAR_CORE_PATH_TEMP}/block-producer.json`);
        process.kill(pid, signal);
        return publicKeys;
    } catch {
        return [];
    }
};
