import { Interfaces } from "@solar-network/crypto";

import { BlockProcessorResult } from "./block-processor";

export interface BlockHandler {
    execute(block?: Interfaces.IBlock): Promise<BlockProcessorResult>;
}
