import { Contracts } from "@solar-network/kernel";

export class CreateTransactionsVoteTable implements Contracts.Database.Migration {
    public description: string = "Creating transactions_vote table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS transactions_vote (
                transactions_row INTEGER NOT NULL REFERENCES transactions(row),
                identity_id INTEGER NOT NULL REFERENCES identities(id),
                percent REAL NOT NULL,
                PRIMARY KEY(transactions_row, identity_id)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_transactions_vote_transactions_row_identity_id ON transactions_vote(transactions_row, identity_id)",
            "CREATE INDEX IF NOT EXISTS index_transactions_vote_transactions_row_percent ON transactions_vote(transactions_row, percent)",
        ]);
    }
}
