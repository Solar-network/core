import { Identities } from "@solar-network/crypto";
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddSenderIdToTransactionsTable20220817000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Adding sender_id to transactions table",
        );
        await queryRunner.query(`
            ALTER TABLE transactions ADD COLUMN sender_id VARCHAR(34);
        `);
        const senderPublicKeys = await queryRunner.query(
            `SELECT DISTINCT(sender_public_key) "senderPublicKey" FROM transactions`,
        );
        for (const { senderPublicKey } of senderPublicKeys) {
            await queryRunner.query(`
                UPDATE transactions SET sender_id = '${Identities.Address.fromPublicKey(senderPublicKey)}'
                WHERE sender_id IS NULL AND sender_public_key = '${senderPublicKey}';
            `);
        }
        await queryRunner.query(`
            ALTER TABLE transactions ALTER COLUMN sender_id SET NOT NULL;
            CREATE INDEX transactions_sender_id ON transactions(sender_id);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX transactions_sender_id;

            ALTER TABLE transactions DROP COLUMN sender_id;
        `);
    }
}
