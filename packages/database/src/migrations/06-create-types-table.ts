import { Contracts } from "@solar-network/kernel";

export class CreateTypesTable implements Contracts.Database.Migration {
    public description: string = "Creating types table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS types (
                id INTEGER PRIMARY KEY,
                height INTEGER NOT NULL,
                type TEXT NOT NULL,
                UNIQUE(type)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_types_height ON types(height)",
            "CREATE INDEX IF NOT EXISTS index_types_type ON types(type)",
        ]);
    }
}
