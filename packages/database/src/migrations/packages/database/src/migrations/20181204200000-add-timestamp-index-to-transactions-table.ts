import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTimestampIndexToTransactionsTable20181204200000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Adding timestamp index to transactions table",
        );
        await queryRunner.query(`
             CREATE INDEX "transactions_timestamp" ON transactions ("timestamp");
         `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
             DROP INDEX "transactions_timestamp";
         `);
    }
}
