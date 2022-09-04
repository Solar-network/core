import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMissedBlocksTable20220814000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug("Database migration: Creating missed_blocks table");
        await queryRunner.query(`
            CREATE TABLE missed_blocks (
                "timestamp" INTEGER PRIMARY KEY,
                "height" INTEGER NOT NULL,
                "username" VARCHAR(20) NOT NULL
            );
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP TABLE missed_blocks;
        `);
    }
}
