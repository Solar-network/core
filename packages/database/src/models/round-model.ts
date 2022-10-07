import { Utils } from "@solar-network/crypto";
import { Contracts } from "@solar-network/kernel";

import { BigNumber, Buffer, Identity } from "./decorators";

export class RoundModel implements Contracts.Database.RoundModel {
    @BigNumber()
    public balance!: Utils.BigNumber;

    @Buffer()
    public publicKey!: string;

    @Identity()
    public username!: string;

    public round!: number;

    public static from(model: RoundModel): Record<string, any> {
        return {
            round: model.round,
            balance: model.balance,
            foreignKeys: {
                publicKey: model.publicKey,
                username: model.username,
            },
        };
    }

    public static to(raw: Record<string, any>): RoundModel {
        return Object.assign({}, new RoundModel(), {
            round: raw.round,
            balance: raw.balance,
            publicKey: raw.publicKey,
            username: raw.username,
        });
    }
}
