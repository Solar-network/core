import { Enums } from "@solar-network/crypto";
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddUsernameToBlocksTable20220813000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug("Database migration: Adding username to blocks table");
        await queryRunner.query(`
            ALTER TABLE blocks ADD COLUMN username VARCHAR(20);
            WITH delegates AS (
                SELECT sender_public_key, asset->'delegate'->>'username' AS username FROM transactions WHERE type_group = ${Enums.TransactionTypeGroup.Core} AND type = ${Enums.CoreTransactionType.DelegateRegistration}
            )
            UPDATE blocks
            SET username = delegates.username
            FROM delegates
            WHERE blocks.generator_public_key = delegates.sender_public_key;
            CREATE INDEX blocks_username ON blocks(username);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX blocks_username;

            ALTER TABLE blocks DROP COLUMN username;
        `);
    }
}
