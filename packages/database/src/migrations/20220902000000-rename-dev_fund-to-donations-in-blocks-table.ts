import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameDevFundToDonationsInBlocksTable20220902000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Renaming dev_fund to donations in blocks table",
        );
        await queryRunner.query(`
            ALTER TABLE blocks RENAME dev_fund TO donations;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            ALTER TABLE blocks RENAME donations TO dev_fund;
        `);
    }
}
