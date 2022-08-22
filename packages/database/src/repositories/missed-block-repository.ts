import { Enums } from "@solar-network/crypto";
import { EntityRepository } from "typeorm";

import { MissedBlock } from "../models";
import { AbstractRepository } from "./abstract-repository";

@EntityRepository(MissedBlock)
export class MissedBlockRepository extends AbstractRepository<MissedBlock> {
    public async addMissedBlocks(
        missedBlocks: { timestamp: number; height: number; username: string }[],
    ): Promise<void> {
        const missedBlockEntities: MissedBlock[] = [];
        return this.manager.transaction(async (manager) => {
            for (const missedBlock of missedBlocks) {
                const missedBlockEntity = Object.assign(new MissedBlock(), { ...missedBlock });
                missedBlockEntities.push(missedBlockEntity);
            }
            await manager.save<MissedBlock>(missedBlockEntities, { chunk: 1000 });
        });
    }

    public async getBlockProductivity(timestamp: number): Promise<Record<string, Record<string, number>>> {
        const productivityStatistics = await this.query(`
            SELECT
            usernames.username,
            missed.count missed,
            CASE WHEN produced IS NULL THEN
                CASE WHEN missed IS NULL THEN
                    NULL
                ELSE
                    0.00
                END
            ELSE
                ROUND((COALESCE(produced.count::numeric, 0) / (COALESCE(produced.count::numeric, 0) + COALESCE(missed.count::numeric, 0))) * 100, 2)
            END productivity
            FROM
                (SELECT asset->'delegate'->>'username' AS username
                FROM transactions
                WHERE type_group = ${Enums.TransactionTypeGroup.Core} AND type = ${Enums.CoreTransactionType.DelegateRegistration})
                usernames
            FULL OUTER JOIN
                (SELECT COUNT(username) AS count, username
                FROM blocks
                WHERE timestamp >= ${timestamp} GROUP BY username)
                produced ON usernames.username = produced.username
            FULL OUTER JOIN
                (SELECT COUNT(username) AS count, username
                FROM missed_blocks
                WHERE timestamp >= ${timestamp} GROUP BY username)
                missed ON usernames.username = missed.username;
        `);

        const delegateProductivity = {};
        for (const { username, missed, productivity } of productivityStatistics) {
            delegateProductivity[username] = { missed, productivity };
        }

        return delegateProductivity;
    }

    public async hasMissedBlocks(): Promise<boolean> {
        return (await this.query("SELECT COUNT(*) count FROM missed_blocks"))[0].count > 0;
    }
}
