import { Commands, Container, Contracts, Utils } from "@solar-network/core-cli";
import { Container as KernelContainer, Contracts as KernelContracts } from "@solar-network/core-kernel";
import { Networks } from "@solar-network/crypto";
import Joi from "joi";

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
    public signature: string = "snapshot:verify";

    /**
     * The console command description.
     *
     * @type {string}
     * @memberof Command
     */
    public description: string = "Check validity of specified snapshot";

    /**
     * Configure the console command.
     *
     * @returns {void}
     * @memberof Command
     */
    public configure(): void {
        this.definition
            .setFlag("token", "The name of the token", Joi.string().default("solar"))
            .setFlag("network", "The name of the network", Joi.string().valid(...Object.keys(Networks)))
            .setFlag("blocks", "Blocks to verify, correlates to folder name", Joi.string().required());
    }

    /**
     * Execute the console command.
     *
     * @returns {Promise<void>}
     * @memberof Command
     */
    public async execute(): Promise<void> {
        const flags: Contracts.AnyObject = { ...this.getFlags() };
        flags.processType = "snapshot";

        const app = await Utils.buildApplication({
            flags,
        });

        await app
            .get<KernelContracts.Snapshot.SnapshotService>(KernelContainer.Identifiers.SnapshotService)
            .verify(flags as any);

        await app.terminate();
    }
}
