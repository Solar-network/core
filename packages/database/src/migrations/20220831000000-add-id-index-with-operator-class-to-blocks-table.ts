import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIdIndexWithOperatorClassToBlocksTable20220831000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Adding id index with operator class to blocks table",
        );
        await queryRunner.query(`
            CREATE INDEX blocks_id ON blocks(id varchar_pattern_ops);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX blocks_id;
        `);
    }
}
