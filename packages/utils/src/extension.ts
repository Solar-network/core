import { extname } from "path";

export const extension = (path: string): string | undefined => extname(path).substr(1) || undefined;
