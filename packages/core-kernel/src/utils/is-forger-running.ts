import { readFileSync } from "fs";

export const isForgerRunning = (): boolean => {
    return sendForgerSignal(0);
};

export const sendForgerSignal = (signal: string | number): boolean => {
    try {
        const forgerPid: number = +readFileSync(`${process.env.CORE_PATH_TEMP}/forger.pid`).toString();
        process.kill(forgerPid, signal);
        return true;
    } catch {
        return false;
    }
};
