import { Contracts } from "@solar-network/kernel";

import { Identity } from "./decorators";

export class BlockProductionFailureModel implements Contracts.Database.BlockProductionFailureModel {
    @Identity()
    public username!: string;

    public height!: number;

    public timestamp!: number;

    public static from(model: BlockProductionFailureModel): Record<string, any> {
        return {
            height: model.height,
            timestamp: model.timestamp,
            foreignKeys: {
                username: model.username,
            },
        };
    }

    public static to(raw: Record<string, any>): BlockProductionFailureModel {
        return Object.assign({}, new BlockProductionFailureModel(), {
            height: raw.height,
            timestamp: raw.timestamp,
            username: raw.username,
        });
    }
}
