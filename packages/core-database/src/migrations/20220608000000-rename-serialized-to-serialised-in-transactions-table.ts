import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameSerializedToSerialisedInTransactionsTable20220608000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            ALTER TABLE transactions RENAME serialized TO serialised;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            ALTER TABLE transactions RENAME serialised TO serialized;
        `);
    }
}
