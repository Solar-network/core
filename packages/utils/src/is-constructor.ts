export const isConstructor = (value: any): boolean => !!value.prototype && !!value.prototype.constructor.name;
