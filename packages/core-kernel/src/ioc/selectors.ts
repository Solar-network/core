import { interfaces } from "inversify";

export const anyAncestorOrTargetTaggedFirst = (
    key: string | number | symbol,
    value: string,
): ((req: interfaces.Request) => boolean) => {
    return (req: interfaces.Request) => {
        for (;;) {
            const targetTags = req.target.getCustomTags();
            if (targetTags) {
                const targetTag = targetTags.find((t) => t.key === key);
                if (targetTag) {
                    return targetTag.value === value;
                }
            }
            if (!req.parentRequest) {
                return false;
            }
            req = req.parentRequest;
        }
    };
};
