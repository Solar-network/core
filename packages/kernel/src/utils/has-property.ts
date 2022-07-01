export const hasProperty = <T>(object: T, prop: string): boolean => Object.prototype.hasOwnProperty.call(object, prop);
