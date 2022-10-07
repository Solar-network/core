import { Contracts } from "@solar-network/kernel";

export class CreateMigrationsTable implements Contracts.Database.Migration {
    public description: string = "Creating migrations table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                timestamp INTEGER NOT NULL,
                UNIQUE(name)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_migrations_name ON migrations(name)",
        ]);
    }
}
