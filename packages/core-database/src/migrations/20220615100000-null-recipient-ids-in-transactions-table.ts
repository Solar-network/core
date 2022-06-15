import { Enums } from "@solar-network/crypto";
import { MigrationInterface, QueryRunner } from "typeorm";

export class NullRecipientIdsInTransactionsTable20220615100000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            UPDATE transactions SET recipient_id = NULL WHERE type_group <> ${Enums.TransactionTypeGroup.Core} OR (type_group = ${Enums.TransactionTypeGroup.Core} AND type <> ${Enums.TransactionType.Core.Transfer} AND type <> ${Enums.TransactionType.HtlcLock});
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        //
    }
}
