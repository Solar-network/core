import { isAbsolute, relative, resolve } from "path";

export const isInsideCoreDirectory = (): boolean => {
    const corePath = resolve(`${__dirname}/../../../../`);
    const relativePath = relative(corePath, process.cwd());
    return !!(
        process.cwd() === corePath ||
        (relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath))
    );
};
