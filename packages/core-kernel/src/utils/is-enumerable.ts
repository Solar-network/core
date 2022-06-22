export const isEnumerable = <T>(object: T, prop: number | string): boolean =>
    Object.prototype.propertyIsEnumerable.call(object, prop);
