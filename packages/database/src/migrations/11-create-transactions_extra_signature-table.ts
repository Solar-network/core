import { Contracts } from "@solar-network/kernel";

export class CreateTransactionsExtraSignatureTable implements Contracts.Database.Migration {
    public description: string = "Creating transactions_extra_signature table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS transactions_extra_signature (
                transactions_row INTEGER PRIMARY KEY REFERENCES transactions(row),
                public_key_id INTEGER NOT NULL REFERENCES public_keys(id)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_transactions_extra_signature_public_key_id_transactions_row ON transactions_extra_signature(public_key_id, transactions_row)",
            "CREATE INDEX IF NOT EXISTS index_transactions_extra_signature_transactions_row_public_key_id ON transactions_extra_signature(transactions_row, public_key_id)",
        ]);
    }
}
