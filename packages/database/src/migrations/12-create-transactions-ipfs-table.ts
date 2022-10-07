import { Contracts } from "@solar-network/kernel";

export class CreateTransactionsIPFSTable implements Contracts.Database.Migration {
    public description: string = "Creating transactions_ipfs table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS transactions_ipfs (
                transactions_row INTEGER PRIMARY KEY REFERENCES transactions(row),
                hash BLOB NOT NULL
            ) STRICT`,
            "CREATE INDEX IF NOT EXISTS index_transactions_ipfs_hash_transactions_row ON transactions_ipfs(hash, transactions_row)",
            "CREATE INDEX IF NOT EXISTS index_transactions_ipfs_transactions_row_hash ON transactions_ipfs(transactions_row, hash)",
        ]);
    }
}
