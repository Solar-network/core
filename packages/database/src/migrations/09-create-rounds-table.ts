import { Contracts } from "@solar-network/kernel";

export class CreateRoundsTable implements Contracts.Database.Migration {
    public description: string = "Creating rounds table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS rounds (
                round INTEGER NOT NULL,
                public_key_id INTEGER NOT NULL REFERENCES public_keys(id),
                balance INTEGER NOT NULL,
                identity_id INTEGER NOT NULL,
                PRIMARY KEY(round, public_key_id)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_rounds_round ON rounds(round)",
        ]);
    }
}
