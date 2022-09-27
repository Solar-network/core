import { Commands, Container, Contracts } from "@solar-network/cli";
import boxen from "boxen";
import { blue, bold, cyan } from "colorette";

/**
 * @export
 * @class Command
 * @extends {Commands.Command}
 */
@Container.injectable()
export class Command extends Commands.Command {
    /**
     * The console command signature.
     *
     * @type {string}
     * @memberof Command
     */
    public signature: string = "help";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Displays detailed information on all commands available via CLI";

    /**
     * Indicates whether the command requires a network to be present.
     *
     * @type {boolean}
     * @memberof Command
     */
    public requiresNetwork: boolean = false;

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        const commands: Contracts.CommandList = this.app.get(Container.Identifiers.Commands);

        // figure out the longest signature
        const signatures: string[] = Object.keys(commands);
        const longestSignature: number = signatures.reduce((a, b) => (a.length > b.length ? a : b)).length;

        // create groups
        const signatureGroups: Record<string, string[]> = {};
        for (const signature of signatures) {
            const groupName: string = signature.includes(":") ? signature.split(":")[0] : "default";

            if (!commands[signature].hide.includes(signature)) {
                if (!signatureGroups[groupName]) {
                    signatureGroups[groupName] = [];
                }

                signatureGroups[groupName].push(signature);
            }
        }

        // turn everything into a human readable format
        const commandsAsString: string[] = [];
        for (const [signatureGroup, signatures] of Object.entries(signatureGroups)) {
            commandsAsString.push(cyan(bold(signatureGroup)));

            for (const signature of signatures) {
                commandsAsString.push(
                    `  ${signature.padEnd(longestSignature, " ")}        ${commands[signature].description.replace(
                        /\.$/,
                        "",
                    )}`,
                );
            }
        }

        console.log(
            boxen(
                this.components.appHeader() +
                    `

${blue("Usage")}
  command [arguments] [flags]

${blue(bold("Flags"))}
  --help                   Display the corresponding help message
  --quiet                  Do not output any message

${blue(bold("Arguments"))}
  -v|vv                    Increase verbosity of messages: 1 for verbose output and 2 for debug

${blue(bold("Available Commands"))}
${commandsAsString.join("\n")}`,
                {
                    padding: 1,
                    borderStyle: "classic",
                },
            ),
        );
    }
}
