import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTimestampUsernameIndexToBlocksTable20220904000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Adding timestamp, username index to blocks table",
        );
        await queryRunner.query(`
            CREATE INDEX blocks_timestamp_username ON blocks(timestamp, username);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP INDEX blocks_timestamp_username;
        `);
    }
}
