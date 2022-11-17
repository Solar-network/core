import { Contracts } from "@solar-network/kernel";

export class CreateTransactionsTable implements Contracts.Database.Migration {
    public description: string = "Creating transactions table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS transactions (
                row INTEGER PRIMARY KEY,
                id BLOB NOT NULL,
                block_height INTEGER NOT NULL REFERENCES blocks(height),
                fee INTEGER NOT NULL,
                identity_id INTEGER NOT NULL REFERENCES identities(id),
                memo TEXT DEFAULT "",
                nonce INTEGER NOT NULL,
                public_key_id INTEGER NOT NULL REFERENCES public_keys(id),
                sequence INTEGER NOT NULL,
                serialised BLOB NOT NULL,
                timestamp INTEGER NOT NULL,
                type_id INTEGER NOT NULL REFERENCES types(id),
                version INTEGER NOT NULL,
                UNIQUE (id),
                UNIQUE (identity_id, nonce)
            ) STRICT`,
            "CREATE VIRTUAL TABLE IF NOT EXISTS transactions_id_fts USING fts5(id, memo, content=transactions, content_rowid=row)",
            "CREATE VIRTUAL TABLE IF NOT EXISTS transactions_memo_fts USING fts5(memo, content=transactions, content_rowid=row, tokenize='trigram')",
            `CREATE TRIGGER IF NOT EXISTS transactions_after_insert AFTER INSERT ON transactions
            BEGIN
                INSERT INTO transactions_id_fts(rowid, id) VALUES (new.row, LOWER(HEX(new.id)));
                INSERT INTO transactions_memo_fts(rowid, memo) VALUES (new.row, new.memo);
            END`,
            `CREATE TRIGGER IF NOT EXISTS transactions_after_delete AFTER DELETE ON transactions BEGIN
                INSERT INTO transactions_id_fts(transactions_id_fts, rowid, id) VALUES('delete', old.row, LOWER(HEX(old.id)));
                INSERT INTO transactions_memo_fts(transactions_memo_fts, rowid, memo) VALUES('delete', old.row, old.memo);
            END`,
            "CREATE INDEX IF NOT EXISTS index_transactions_block_height ON transactions(block_height)",
            "CREATE INDEX IF NOT EXISTS index_transactions_block_height_fee ON transactions(block_height, fee)",
            "CREATE INDEX IF NOT EXISTS index_transactions_block_height_sequence ON transactions(block_height, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_fee ON transactions(fee)",
            "CREATE INDEX IF NOT EXISTS index_transactions_fee_asc_sequence ON transactions(fee ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_fee_sequence ON transactions(fee, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_identity_id ON transactions(identity_id)",
            "CREATE INDEX IF NOT EXISTS index_transactions_identity_id_fee_nonce ON transactions(identity_id, fee, nonce)",
            "CREATE INDEX IF NOT EXISTS index_transactions_memo ON transactions(memo)",
            "CREATE INDEX IF NOT EXISTS index_transactions_memo_asc_sequence ON transactions(memo ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_memo_sequence ON transactions(memo, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_nonce_asc_sequence ON transactions(nonce ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_nonce_idx ON transactions(nonce)",
            "CREATE INDEX IF NOT EXISTS index_transactions_nonce_sequence ON transactions(nonce, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_public_key_id ON transactions(public_key_id)",
            "CREATE INDEX IF NOT EXISTS index_transactions_timestamp ON transactions(timestamp)",
            "CREATE INDEX IF NOT EXISTS index_transactions_timestamp_asc_sequence ON transactions(timestamp ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_timestamp_sequence ON transactions(timestamp, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id ON transactions(type_id)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_asc_sequence ON transactions(type_id ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_block_height_asc_sequence_asc ON transactions(type_id, block_height ASC, sequence ASC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_block_height_sequence ON transactions(type_id, block_height, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_fee_asc_sequence ON transactions(type_id, fee ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_fee_sequence ON transactions(type_id, fee, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_identity_id_block_height ON transactions(type_id, identity_id, block_height)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_identity_id_block_height_sequence ON transactions(type_id, identity_id, block_height, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_memo_asc_sequence ON transactions(type_id, memo ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_memo_sequence ON transactions(type_id, memo, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_nonce_asc_sequence ON transactions(type_id, nonce ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_nonce_sequence ON transactions(type_id, nonce, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_sequence ON transactions(type_id, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_timestamp_asc_sequence ON transactions(type_id, timestamp ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_timestamp_sequence ON transactions(type_id, timestamp, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_version_asc_sequence ON transactions(type_id, version ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_type_id_version_sequence ON transactions(type_id, version, sequence)",
            "CREATE INDEX IF NOT EXISTS index_transactions_unique ON transactions(public_key_id, memo, timestamp)",
            "CREATE INDEX IF NOT EXISTS index_transactions_version ON transactions(version)",
            "CREATE INDEX IF NOT EXISTS index_transactions_version_asc_sequence ON transactions(version ASC, sequence DESC)",
            "CREATE INDEX IF NOT EXISTS index_transactions_version_sequence ON transactions(version, sequence)",
        ]);
    }
}
