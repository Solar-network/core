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

            CREATE FUNCTION delete_missed_blocks_on_delete() RETURNS TRIGGER
            AS
            $$
            BEGIN
                DELETE
                FROM missed_blocks
                WHERE height >= OLD.height;
                RETURN OLD;
            END;
            $$
            LANGUAGE PLPGSQL
            VOLATILE;

            CREATE TRIGGER delete_missed_blocks_on_delete
            BEFORE DELETE
            ON blocks
            FOR EACH ROW
            EXECUTE PROCEDURE delete_missed_blocks_on_delete();
    `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            DROP TRIGGER delete_missed_blocks_on_delete ON blocks;

            DROP FUNCTION delete_missed_blocks_on_delete();

            DROP TABLE missed_blocks;
        `);
    }
}
