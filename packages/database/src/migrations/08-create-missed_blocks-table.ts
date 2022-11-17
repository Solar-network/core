import { Contracts } from "@solar-network/kernel";

export class CreateMissedBlocksTable implements Contracts.Database.Migration {
    public description: string = "Creating missed_blocks table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS missed_blocks (
                height INTEGER NOT NULL,
                identity_id INTEGER NOT NULL REFERENCES identities(id),
                timestamp INTEGER PRIMARY KEY
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_missed_blocks_height ON missed_blocks(height)",
            "CREATE INDEX IF NOT EXISTS index_missed_blocks_identity_id ON missed_blocks(identity_id)",
            "CREATE INDEX IF NOT EXISTS index_missed_blocks_timestamp ON missed_blocks(timestamp)",
            "CREATE INDEX IF NOT EXISTS index_missed_blocks_timestamp_identity_id ON missed_blocks(timestamp, identity_id)",
        ]);
    }
}
