import { isNull } from "./is-null";

interface URIScheme {
    scheme: string | undefined;
    authority: string | undefined;
    path: string | undefined;
    query: string | undefined;
    fragment: string | undefined;
}

export const parseURI = (value: string): URIScheme | undefined => {
    const matches: RegExpExecArray | null = new RegExp(
        "^(([^:/?#]+):)?(//([^/?#]*))?([^?#]*)(\\?([^#]*))?(#(.*))?",
    ).exec(value);

    /* istanbul ignore next */
    if (isNull(matches)) {
        return undefined;
    }

    return {
        scheme: matches[2],
        authority: matches[4],
        path: matches[5],
        query: matches[7],
        fragment: matches[9],
    };
};
