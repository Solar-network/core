import { Contracts } from "@solar-network/kernel";

import { Identity } from "./decorators";

export class MissedBlockModel implements Contracts.Database.MissedBlockModel {
    @Identity()
    public username!: string;

    public height!: number;

    public timestamp!: number;

    public static from(model: MissedBlockModel): Record<string, any> {
        return {
            height: model.height,
            timestamp: model.timestamp,
            foreignKeys: {
                username: model.username,
            },
        };
    }

    public static to(raw: Record<string, any>): MissedBlockModel {
        return Object.assign({}, new MissedBlockModel(), {
            height: raw.height,
            timestamp: raw.timestamp,
            username: raw.username,
        });
    }
}
