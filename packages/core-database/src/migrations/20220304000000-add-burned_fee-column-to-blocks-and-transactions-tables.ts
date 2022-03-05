import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBurnedFeeColumnToBlocksAndTransactionsTables20220304000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            ALTER TABLE blocks ADD COLUMN burned_fee BIGINT NOT NULL DEFAULT 0;
            ALTER TABLE transactions ADD COLUMN burned_fee BIGINT NOT NULL DEFAULT 0;

            CREATE INDEX blocks_burned_fee ON blocks(burned_fee);
            CREATE INDEX transactions_burned_fee ON transactions(burned_fee);
            CREATE INDEX transactions_burned_fee_sequence ON transactions(burned_fee, sequence);
            CREATE INDEX transactions_burned_fee_asc_sequence ON transactions(burned_fee ASC, sequence DESC);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX transactions_burned_fee;
            DROP INDEX transactions_burned_fee_sequence;
            DROP INDEX transactions_burned_fee_asc_sequence;
            DROP INDEX burned_fee;

            ALTER TABLE transactions DROP COLUMN burned_fee;
            ALTER TABLE blocks DROP COLUMN burned_fee;
        `);
    }
}
