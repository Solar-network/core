import { Contracts } from "@solar-network/kernel";

export class CreateBlockProductionFailuresTable implements Contracts.Database.Migration {
    public description: string = "Creating block_production_failures table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS block_production_failures (
                height INTEGER NOT NULL,
                identity_id INTEGER NOT NULL REFERENCES identities(id),
                timestamp INTEGER PRIMARY KEY
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_block_production_failures_height ON block_production_failures(height)",
            "CREATE INDEX IF NOT EXISTS index_block_production_failures_identity_id ON block_production_failures(identity_id)",
            "CREATE INDEX IF NOT EXISTS index_block_production_failures_timestamp ON block_production_failures(timestamp)",
            "CREATE INDEX IF NOT EXISTS index_block_production_failures_timestamp_identity_id ON block_production_failures(timestamp, identity_id)",
        ]);
    }
}
