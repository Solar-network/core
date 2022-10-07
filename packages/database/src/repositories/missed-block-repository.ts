import { Container, Contracts } from "@solar-network/kernel";

import { MissedBlockModel } from "../models";
import { Repository } from "./repository";

@Container.injectable()
export class MissedBlockRepository
    extends Repository<MissedBlockModel>
    implements Contracts.Database.MissedBlockRepository
{
    protected model: typeof MissedBlockModel = MissedBlockModel;

    public async getBlockProductivity(timestamp: number): Promise<Record<string, Record<string, number>>> {
        const delegates: Record<string, string>[] = await this.createQueryBuilder()
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

        const missedBlocks: Record<string, string | number>[] = await this.createQueryBuilder()
            .select("COUNT(identity_id)", "count")
            .select(
                "CAST((SELECT identity FROM identities WHERE identities.id = identity_id LIMIT 1) AS TEXT)",
                "username",
            )
            .from("missed_blocks")
            .where("timestamp >= :timestamp", { timestamp })
            .groupBy("identity_id")
            .run();

        const delegateProductivity = {};

        for (const { username } of delegates) {
            let missed: number | undefined = +(
                missedBlocks.find((delegate) => delegate.username === username)?.count ?? NaN
            );
            let produced: number | undefined = +(
                producedBlocks.find((delegate) => delegate.username === username)?.count ?? NaN
            );
            let productivity: number | undefined;

            if (isNaN(missed)) {
                missed = undefined;
            }

            if (isNaN(produced)) {
                produced = undefined;
            }

            if (produced !== undefined || missed !== undefined) {
                if (produced === undefined) {
                    productivity = 0;
                } else {
                    if (missed === undefined) {
                        missed = 0;
                    }
                    productivity = +((produced / (produced + missed)) * 100).toFixed(2);
                }
            }

            delegateProductivity[username] = {
                missed,
                productivity,
            };
        }

        return delegateProductivity;
    }

    public async hasMissedBlocks(): Promise<boolean> {
        return (
            Number(
                (await this.createQueryBuilder().select("COUNT(timestamp)", "count").from("missed_blocks").run())[0]
                    .count,
            ) > 0
        );
    }

    protected getFullQueryBuilder(): Contracts.Database.QueryBuilder {
        return this.createQueryBuilder()
            .select("height")
            .select("timestamp")
            .select(
                "CAST((SELECT identity FROM identities WHERE identities.id = missed_blocks.identity_id LIMIT 1) AS TEXT)",
                "username",
            )
            .from("missed_blocks");
    }
}
