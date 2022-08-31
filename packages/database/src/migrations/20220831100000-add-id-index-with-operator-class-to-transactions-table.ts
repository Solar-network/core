import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdIndexWithOperatorClassToTransactionsTable20220831100000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Adding id index with operator class to transactions table",
        );
        await queryRunner.query(`
            CREATE INDEX transactions_id ON transactions(id varchar_pattern_ops);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX transactions_id;
        `);
    }
}
