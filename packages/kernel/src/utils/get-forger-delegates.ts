import { readJsonSync } from "fs-extra";

export const getForgerDelegates = (): string[] => {
    return sendForgerSignal(0);
};

export const sendForgerSignal = (signal: string | number): string[] => {
    try {
        const { pid, publicKeys } = readJsonSync(`${process.env.SOLAR_CORE_PATH_TEMP}/forger.json`);
        process.kill(pid, signal);
        return publicKeys;
    } catch {
        return [];
    }
};
