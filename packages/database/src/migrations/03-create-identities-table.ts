import { Contracts } from "@solar-network/kernel";

export class CreateIdentitiesTable implements Contracts.Database.Migration {
    public description: string = "Creating identities table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS identities (
                id INTEGER PRIMARY KEY,
                height INTEGER NOT NULL,
                identity BLOB NOT NULL,
                is_username INTEGER NOT NULL,
                UNIQUE(identity)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_identities_identity_is_username ON identities(identity, is_username)",
            "CREATE INDEX IF NOT EXISTS index_identities_height ON identities(height)",
            "CREATE INDEX IF NOT EXISTS index_identities_is_username ON identities(is_username)",
        ]);
    }
}
