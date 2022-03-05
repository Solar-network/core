export const formatString = (...args: any[]): string => {
    let output: string = args[0];

    args.shift();

    for (let i = 0; i < args.length; i++) {
        output = output.replace(`{${i}}`, args[i]);
    }

    return output;
};
