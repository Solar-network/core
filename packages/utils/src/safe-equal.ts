import { timingSafeEqual } from "crypto";

export const safeEqual = (a: DataView, b: DataView): boolean => {
    try {
        return timingSafeEqual(a, b);
    } catch {
        return false;
    }
};
