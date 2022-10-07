import { Contracts } from "@packages/kernel/dist";

import { Identity } from "./decorators";

export class IdentityModel implements Contracts.Database.IdentityModel {
    @Identity()
    public identity!: string;

    public id!: number;

    public isUsername!: boolean;
}
