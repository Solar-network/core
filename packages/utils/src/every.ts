import { FunctionReturning } from "./internal";

export const every = <T>(subject: T[], iterator: FunctionReturning): boolean => {
    for (let i = 0; i < subject.length; i++) {
        if (!iterator(subject[i], i, subject)) {
            return false;
        }
    }

    return true;
};
