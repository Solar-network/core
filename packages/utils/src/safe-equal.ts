import { timingSafeEqual } from "crypto";

export const safeEqual = (a: any, b: any): boolean => {
    try {
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
};
