import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBlocksTable20180305300000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug("Database migration: Creating blocks table");
        await queryRunner.query(`
            CREATE TABLE blocks (
                "id" VARCHAR(64) PRIMARY KEY,
                "version" SMALLINT NOT NULL,
                "timestamp" INTEGER UNIQUE NOT NULL,
                "previous_block" VARCHAR(64) UNIQUE,
                "height" INTEGER UNIQUE NOT NULL,
                "number_of_transactions" INTEGER NOT NULL,
                "total_amount" BIGINT NOT NULL,
                "total_fee" BIGINT NOT NULL,
                "reward" BIGINT NOT NULL,
                "payload_length" INTEGER NOT NULL,
                "payload_hash" VARCHAR(64) NOT NULL,
                "generator_public_key" VARCHAR(66) NOT NULL,
                "block_signature" VARCHAR(256) NOT NULL
            );
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.dropTable("blocks");
    }
}
