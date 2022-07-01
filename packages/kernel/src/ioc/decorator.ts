import { decorate, injectable } from "inversify";

export const decorateInjectable = (target: object): void => {
    try {
        decorate(injectable(), target);
    } catch {}
};
