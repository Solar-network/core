import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameMemoToMemoInTransactionsTable20220618000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            ALTER TABLE transactions RENAME vendor_field TO memo;
            ALTER INDEX transactions_vendor_field RENAME TO transactions_memo;
            ALTER INDEX transactions_vendor_field_asc_sequence RENAME TO transactions_memo_asc_sequence;
            ALTER INDEX transactions_vendor_field_sequence RENAME TO transactions_memo_sequence;
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            ALTER TABLE transactions RENAME memo TO vendor_field;
            ALTER INDEX transactions_memo RENAME TO transactions_vendor_field;
            ALTER INDEX transactions_memo_asc_sequence RENAME TO transactions_vendor_field_asc_sequence;
            ALTER INDEX transactions_memo_sequence RENAME TO transactions_vendor_field_sequence;
        `);
    }
}
