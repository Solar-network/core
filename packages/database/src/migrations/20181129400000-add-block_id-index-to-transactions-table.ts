import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBlockIdIndexToTransactionsTable20181129400000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Adding block_id index to transactions table",
        );
        await queryRunner.query(`
            CREATE INDEX "transactions_block_id" ON transactions ("block_id");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX "transactions_block_id";
        `);
    }
}
