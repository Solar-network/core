import { Contracts } from "@solar-network/kernel";

export class CreateBlocksTable implements Contracts.Database.Migration {
    public description: string = "Creating blocks table";

    public async migrate(queryRunner: Contracts.Database.QueryRunner): Promise<any> {
        await queryRunner.transaction([
            `CREATE TABLE IF NOT EXISTS blocks (
                id BLOB NOT NULL,
                height INTEGER PRIMARY KEY,
                identity_id INTEGER REFERENCES identities(id),
                number_of_transactions INTEGER NOT NULL,
                payload_hash BLOB NOT NULL,
                payload_length INTEGER NOT NULL,
                previous_block_height INTEGER UNIQUE REFERENCES blocks(height),
                public_key_id INTEGER NOT NULL REFERENCES public_keys(id),
                reward INTEGER NOT NULL,
                signature BLOB NOT NULL,
                timestamp INTEGER UNIQUE NOT NULL,
                total_amount INTEGER NOT NULL,
                total_fee INTEGER NOT NULL,
                version INTEGER NOT NULL,
                UNIQUE(id)
            ) STRICT`,
            "CREATE VIRTUAL TABLE IF NOT EXISTS blocks_id_fts USING fts5(id, content=blocks, content_rowid=height)",
            `CREATE TRIGGER IF NOT EXISTS blocks_after_insert AFTER INSERT ON blocks BEGIN
                INSERT INTO blocks_id_fts(rowid, id) VALUES (new.height, LOWER(HEX(new.id)));
            END`,
            `CREATE TRIGGER IF NOT EXISTS blocks_after_delete AFTER DELETE ON blocks BEGIN
                INSERT INTO blocks_id_fts(blocks_id_fts, rowid, id) VALUES('delete', old.height, LOWER(HEX(old.id)));
            END`,
            "CREATE INDEX IF NOT EXISTS index_blocks_height ON blocks(height)",
            "CREATE INDEX IF NOT EXISTS index_blocks_identity_id ON blocks(identity_id)",
            "CREATE INDEX IF NOT EXISTS index_blocks_identity_id_height ON blocks(identity_id, height)",
            "CREATE INDEX IF NOT EXISTS index_blocks_identity_id_height_reward ON blocks(identity_id, height, reward)",
            "CREATE INDEX IF NOT EXISTS index_blocks_identity_id_rewards ON blocks(identity_id, reward, total_fee, total_amount)",
            "CREATE INDEX IF NOT EXISTS index_blocks_identity_id_timestamp ON blocks(identity_id, timestamp)",
            "CREATE INDEX IF NOT EXISTS index_blocks_number_of_transactions ON blocks(number_of_transactions)",
            "CREATE INDEX IF NOT EXISTS index_blocks_number_of_transactions_total_fee_height ON blocks (number_of_transactions, total_fee, height)",
            "CREATE INDEX IF NOT EXISTS index_blocks_public_key_id ON blocks(public_key_id)",
            "CREATE INDEX IF NOT EXISTS index_blocks_public_key_id_height ON blocks(public_key_id, height)",
            "CREATE INDEX IF NOT EXISTS index_blocks_reward ON blocks(reward)",
            "CREATE INDEX IF NOT EXISTS index_blocks_timestamp ON blocks(timestamp)",
            "CREATE INDEX IF NOT EXISTS index_blocks_timestamp_identity_id ON blocks(timestamp, identity_id)",
            "CREATE INDEX IF NOT EXISTS index_blocks_total_amount ON blocks(total_amount)",
            "CREATE INDEX IF NOT EXISTS index_blocks_total_fee ON blocks(total_fee)",
            "CREATE INDEX IF NOT EXISTS index_blocks_version ON blocks(version)",
        ]);
    }
}
