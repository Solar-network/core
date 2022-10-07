import { Contracts } from "@solar-network/kernel";

export class CreateBalanceTransfersTable implements Contracts.Database.Migration {
    public description: string = "Creating balance_changes table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS balance_changes (
                row INTEGER PRIMARY KEY,
                transactions_row INTEGER NOT NULL REFERENCES transactions(row),
                amount_received INTEGER NOT NULL,
                amount_sent INTEGER NOT NULL,
                local_memo TEXT DEFAULT "",
                token_id INTEGER REFERENCES tokens(id),
                identity_id INTEGER REFERENCES identities(id),
                timelock_type INTEGER DEFAULT 0,
                timelock_expiry INTEGER DEFAULT 0,
                UNIQUE(transactions_row, amount_received, amount_sent, local_memo, token_id, identity_id, timelock_type, timelock_expiry)
            ) STRICT`,
            "CREATE VIRTUAL TABLE IF NOT EXISTS balance_changes_local_memo_fts USING fts5(local_memo, content=balance_changes, content_rowid=row, tokenize='trigram')",
            `CREATE TRIGGER IF NOT EXISTS balance_changes_after_insert AFTER INSERT ON balance_changes
            BEGIN
                INSERT INTO balance_changes_local_memo_fts(rowid, local_memo) VALUES (new.row, new.local_memo);
            END`,
            `CREATE TRIGGER IF NOT EXISTS balance_changes_after_delete AFTER DELETE ON balance_changes BEGIN
                INSERT INTO balance_changes_local_memo_fts(balance_changes_local_memo_fts, rowid, local_memo) VALUES('delete', old.row, old.local_memo);
            END`,
            "CREATE INDEX IF NOT EXISTS index_balance_changes_amount_sent_amount_received_transactions_row ON balance_changes(amount_sent, amount_received, transactions_row)",
            "CREATE INDEX IF NOT EXISTS index_balance_changes_identity_id_transactions_row ON balance_changes(identity_id, transactions_row)",
            "CREATE INDEX IF NOT EXISTS index_balance_changes_local_memo_transactions_row ON balance_changes(local_memo, transactions_row)",
            "CREATE INDEX IF NOT EXISTS index_balance_changes_token_id_transactions_row ON balance_changes(token_id, transactions_row)",
            "CREATE INDEX IF NOT EXISTS index_balance_changes_transactions_row_amount_received ON balance_changes(transactions_row, amount_received)",
            "CREATE INDEX IF NOT EXISTS index_balance_changes_transactions_row_amount_received_amount_sent ON balance_changes(transactions_row, amount_received, amount_sent)",
            "CREATE INDEX IF NOT EXISTS index_balance_changes_transactions_row_local_memo ON balance_changes(transactions_row, local_memo)",
            "CREATE INDEX IF NOT EXISTS index_balance_changes_transactions_row_token_id ON balance_changes(transactions_row, token_id)",
        ]);
    }
}
