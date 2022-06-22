import { flatten } from "./flatten";
import { uniqBy } from "./uniq-by";

export const unionBy = <T>(...args: any[]): T[] => {
    const iteratee = args.pop();

    return uniqBy(flatten(args), iteratee);
};
