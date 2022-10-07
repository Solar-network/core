import { Contracts } from "@packages/kernel/dist";

import { Buffer } from "./decorators";

export class PublicKeyModel implements Contracts.Database.PublicKeyModel {
    @Buffer()
    public publicKey!: string;

    public id!: number;
}
