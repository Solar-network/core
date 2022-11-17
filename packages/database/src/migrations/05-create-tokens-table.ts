import { Contracts } from "@solar-network/kernel";

export class CreateTokensTable implements Contracts.Database.Migration {
    public description: string = "Creating tokens table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS tokens (
                id INTEGER PRIMARY KEY,
                height INTEGER NOT NULL,
                name TEXT NOT NULL,
                ticker TEXT NOT NULL,
                address BLOB NOT NULL,
                supply INTEGER NOT NULL,
                UNIQUE(address)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_tokens_address ON tokens(address)",
            "CREATE INDEX IF NOT EXISTS index_tokens_height ON tokens(height)",
            "CREATE INDEX IF NOT EXISTS index_tokens_name ON tokens(name)",
            "CREATE INDEX IF NOT EXISTS index_tokens_supply ON tokens(supply)",
            "CREATE INDEX IF NOT EXISTS index_tokens_ticker ON tokens(ticker)",
        ]);
    }
}
