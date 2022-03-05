import { parse, UrlWithStringQuery } from "url";

import { last } from "./last";

const getOwner = (value: string): string => {
    const string: number = value.indexOf(":");

    return string > -1 ? value.slice(string + 1) : value;
};

export const parseGitUrl = (
    value: string,
): { host: string; owner: string; name: string; repo: string; branch: string } | undefined => {
    const parsed: UrlWithStringQuery = parse(value);

    if (value.startsWith("git@")) {
        parsed.host = parse("https://" + value).host;
    }

    if (!parsed.host) {
        throw new Error("Failed to find a host.");
    }

    // @ts-ignore - The previous host check will already exit if there are problems
    // but for some reason the node typings say the path could be undefined.
    // This doesn't seem to be the case and it always defaults to at least the host.
    const segments: string[] = parsed.path.split("/").filter(Boolean);

    if (segments.length === 1) {
        throw new Error("Failed to find a name.");
    }

    const owner: string = getOwner(segments[0]);
    const name: string = segments[1].replace(/^\W+|\.git$/g, "");

    const result: { host: string; owner: string; name: string; repo: string; branch: string } = {
        host: parsed.host,
        owner,
        name,
        branch: (parsed.hash ? last(parsed.hash.split("#")) : segments[2]) || "master",
        repo: owner + "/" + name,
    };

    return result;
};
