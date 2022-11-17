import { Contracts } from "@solar-network/kernel";

export class CreateTransactionsRegistrationTable implements Contracts.Database.Migration {
    public description: string = "Creating transactions_registration table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS transactions_registration (
                transactions_row INTEGER PRIMARY KEY REFERENCES transactions(row),
                identity_id INTEGER NOT NULL REFERENCES identities(id)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_transactions_registration_identity_id_transactions_row ON transactions_registration(identity_id, transactions_row)",
            "CREATE INDEX IF NOT EXISTS index_transactions_registration_transactions_row_identity_id ON transactions_registration(transactions_row, identity_id)",
        ]);
    }
}
