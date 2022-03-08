import yargs from "yargs-parser";

/**
 * @export
 * @class InputParser
 */
export class InputParser {
    /**
     * @static
     * @param {string[]} args
     * @returns
     * @memberof InputParser
     */
    public static parseArgv(args: string[]): { args: string[]; flags: yargs.Arguments } {
        const parsed: yargs.Arguments = yargs(args, { count: [] });

        const argv: string[] = parsed._;

        delete (parsed as any)._;

        return { args: argv, flags: parsed };
    }
}
