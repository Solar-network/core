import { Contracts } from "@solar-network/kernel";

export class CreatePublicKeysTable implements Contracts.Database.Migration {
    public description: string = "Creating public_keys table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS public_keys (
                id INTEGER PRIMARY KEY,
                height INTEGER NOT NULL,
                public_key BLOB NOT NULL,
                UNIQUE(public_key)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_public_keys_height ON public_keys(height)",
            "CREATE INDEX IF NOT EXISTS index_public_keys_public_key ON public_keys(public_key)",
        ]);
    }
}
