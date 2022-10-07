import { Contracts } from "@solar-network/kernel";

export class CreateTransactionsResignationTable implements Contracts.Database.Migration {
    public description: string = "Creating transactions_resignation table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS transactions_resignation (
                transactions_row INTEGER PRIMARY KEY REFERENCES transactions(row),
                resignation_type INTEGER NOT NULL
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_transactions_resignation_resignation_transactions_row_type ON transactions_resignation(transactions_row, resignation_type)",
            "CREATE INDEX IF NOT EXISTS index_transactions_resignation_resignation_type_transactions_row ON transactions_resignation(resignation_type, transactions_row)",
        ]);
    }
}
