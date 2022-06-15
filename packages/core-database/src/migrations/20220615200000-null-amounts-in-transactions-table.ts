import { MigrationInterface, QueryRunner } from "typeorm";

export class NullAmountsInTransactionsTable20220615200000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            ALTER TABLE transactions ALTER COLUMN amount DROP NOT NULL;
            UPDATE transactions SET amount = NULL WHERE amount = 0;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            UPDATE transactions SET amount = 0 WHERE amount IS NULL;
            ALTER TABLE transactions ALTER COLUMN amount SET NOT NULL;
        `);
    }
}
