import { MigrationInterface, QueryRunner } from "typeorm";

export class DropIdColumnFromRoundsTable20190619000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug("Database migration: Dropping id from rounds table");
        await queryRunner.query(`
            ALTER TABLE rounds DROP COLUMN id, ADD PRIMARY KEY (round, public_key);
            DROP INDEX rounds_unique;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {}
}
