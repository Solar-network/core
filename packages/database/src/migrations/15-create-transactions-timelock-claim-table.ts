import { Contracts } from "@solar-network/kernel";

export class CreateTransactionsTimelockClaimTable implements Contracts.Database.Migration {
    public description: string = "Creating transactions_timelock_claim table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS transactions_timelock_claim (
                transactions_row INTEGER NOT NULL REFERENCES transactions(row),
                transactions_row_lock INTEGER NOT NULL REFERENCES transactions(row),
                lock_index INTEGER NOT NULL,
                secret BLOB NOT NULL,
                PRIMARY KEY(transactions_row_lock, lock_index)
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_transactions_timelock_claim_lock_transactions_row_transactions_row ON transactions_timelock_claim(transactions_row, transactions_row_lock)",
            "CREATE INDEX IF NOT EXISTS index_transactions_timelock_claim_secret_transactions_row ON transactions_timelock_claim(secret, transactions_row)",
            "CREATE INDEX IF NOT EXISTS index_transactions_timelock_claim_transactions_row_lock_transactions_row ON transactions_timelock_claim(transactions_row_lock, transactions_row)",
            "CREATE INDEX IF NOT EXISTS index_transactions_timelock_claim_transactions_row_secret ON transactions_timelock_claim(transactions_row, secret)",
        ]);
    }
}
