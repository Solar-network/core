export const isConstructor = (value: Function): boolean => !!value.prototype && !!value.prototype.constructor.name;
