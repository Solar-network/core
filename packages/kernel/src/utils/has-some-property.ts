import { hasProperty } from "./has-property";
import { some } from "./some";

export const hasSomeProperty = <T>(object: T, props: string[]): boolean =>
    some(props, (prop: string) => hasProperty(object, prop));
