export function Base58() {
    return (target: object, propertyKey: string) => {
        add(target, propertyKey);
        Reflect.defineMetadata("type", "base58", target, propertyKey);
    };
}
export function Buffer() {
    return (target: object, propertyKey: string) => {
        add(target, propertyKey);
        Reflect.defineMetadata("type", "buffer", target, propertyKey);
    };
}

export function BigNumber() {
    return (target: object, propertyKey: string) => {
        add(target, propertyKey);
        Reflect.defineMetadata("type", "bignumber", target, propertyKey);
    };
}

export function Identity() {
    return (target: object, propertyKey: string) => {
        add(target, propertyKey);
        Reflect.defineMetadata("type", "identity", target, propertyKey);
    };
}

function add(target: object, propertyKey: string) {
    const props: any[] = Reflect.getOwnMetadata("props", target.constructor) || [];
    props.push(propertyKey);
    Reflect.defineMetadata("props", props, target.constructor);
}
