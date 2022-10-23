import { Container, Contracts } from "@solar-network/kernel";

import { Action } from "../contracts";

@Container.injectable()
export class Stopped implements Action {
    @Container.inject(Container.Identifiers.Application)
    public readonly app!: Contracts.Kernel.Application;

    public async handle(): Promise<void> {}
}
