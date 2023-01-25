import { Container, Contracts } from "@solar-network/kernel";

import { BlockProductionFailureModel } from "../models";
import { Repository } from "./repository";

@Container.injectable()
export class BlockProductionFailureRepository
    extends Repository<BlockProductionFailureModel>
    implements Contracts.Database.BlockProductionFailureRepository
{
    protected model: typeof BlockProductionFailureModel = BlockProductionFailureModel;

    public async getReliability(timestamp: number): Promise<Record<string, Record<string, number>>> {
        const blockProducers: Record<string, string>[] = await this.createQueryBuilder()
            .select("CAST(identity AS TEXT)", "username")
            .from("identities")
            .where("is_username = 1")
            .run();

        const producedBlocks: Record<string, string | number>[] = await this.createQueryBuilder()
            .select("COUNT(identity_id)", "count")
            .select(
                "CAST((SELECT identity FROM identities WHERE identities.id = identity_id LIMIT 1) AS TEXT)",
                "username",
            )
            .from("blocks")
            .where("timestamp >= :timestamp", { timestamp })
            .groupBy("identity_id")
            .run();

        const blockProductionFailures: Record<string, string | number>[] = await this.createQueryBuilder()
            .select("COUNT(identity_id)", "count")
            .select(
                "CAST((SELECT identity FROM identities WHERE identities.id = identity_id LIMIT 1) AS TEXT)",
                "username",
            )
            .from("block_production_failures")
            .where("timestamp >= :timestamp", { timestamp })
            .groupBy("identity_id")
            .run();

        const blockProducerReliability = {};

        for (const { username } of blockProducers) {
            let failures: number | undefined = +(
                blockProductionFailures.find((blockProducer) => blockProducer.username === username)?.count ?? NaN
            );
            let produced: number | undefined = +(
                producedBlocks.find((blockProducer) => blockProducer.username === username)?.count ?? NaN
            );
            let reliability: number | undefined;

            if (isNaN(failures)) {
                failures = undefined;
            }

            if (isNaN(produced)) {
                produced = undefined;
            }

            if (produced !== undefined || failures !== undefined) {
                if (produced === undefined) {
                    reliability = 0;
                } else {
                    if (failures === undefined) {
                        failures = 0;
                    }
                    reliability = +((produced / (produced + failures)) * 100).toFixed(2);
                }
            }

            blockProducerReliability[username] = {
                failures,
                reliability,
            };
        }

        return blockProducerReliability;
    }

    public async hasBlockProductionFailures(): Promise<boolean> {
        return (
            Number(
                (
                    await this.createQueryBuilder()
                        .select("COUNT(timestamp)", "count")
                        .from("block_production_failures")
                        .run()
                )[0].count,
            ) > 0
        );
    }

    protected getFullQueryBuilder(): Contracts.Database.QueryBuilder {
        return this.createQueryBuilder()
            .select("height")
            .select("timestamp")
            .select(
                "CAST((SELECT identity FROM identities WHERE identities.id = block_production_failures.identity_id LIMIT 1) AS TEXT)",
                "username",
            )
            .from("block_production_failures");
    }
}
