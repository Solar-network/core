import { MigrationInterface, QueryRunner } from "typeorm";

export class AddDevFundColumnToBlocksTable20220507000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug("Database migration: Adding dev_fund to blocks table");
        await queryRunner.query(`
            ALTER TABLE blocks ADD COLUMN dev_fund JSONB NOT NULL DEFAULT '{}'::jsonb;

            CREATE INDEX blocks_dev_fund ON blocks(dev_fund);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX blocks_dev_fund;

            ALTER TABLE blocks DROP COLUMN dev_fund;
        `);
    }
}
