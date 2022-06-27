import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTypeGroupIndexToTransactionsTable20200304000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Adding type_group index to transactions table",
        );
        await queryRunner.query(`
            CREATE INDEX transactions_type_group ON transactions(type_group);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX transactions_type_group;
        `);
    }
}
