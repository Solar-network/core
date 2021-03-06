import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTypeIndexToTransactionsTable20191008000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Adding type index to transactions table",
        );
        await queryRunner.query(`
            CREATE INDEX "transactions_type" ON transactions ("type");
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX "transactions_type";
        `);
    }
}
