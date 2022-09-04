import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTimestampUsernameIndexToBlocksTable20220904100000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Adding type, type_group index to transactions table",
        );
        await queryRunner.query(`
            CREATE INDEX transactions_type_type_group ON transactions(type, type_group);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX transactions_type_type_group;
        `);
    }
}
