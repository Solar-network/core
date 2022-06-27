import { Enums } from "@solar-network/crypto";
import { MigrationInterface, QueryRunner } from "typeorm";

export class RenamePaymentsToTransfersInAsset20220613000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Renaming payments asset to transfers in transactions table",
        );
        await queryRunner.query(`
            UPDATE transactions SET asset = JSONB_SET(asset #- '{payments}', '{transfers}', asset #> '{payments}') WHERE type_group = ${Enums.TransactionTypeGroup.Core} AND type = ${Enums.TransactionType.Core.Transfer};
            DROP INDEX transactions_asset_payments;
            CREATE INDEX transactions_asset_transfers ON transactions USING GIN ((asset->'transfers')) WITH (fastupdate = off);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            UPDATE transactions SET asset = JSONB_SET(asset #- '{transfers}', '{payments}', asset #> '{transfers}') WHERE type_group = ${Enums.TransactionTypeGroup.Core} AND type = ${Enums.TransactionType.Core.Transfer};
            DROP INDEX transactions_asset_transfers;
            CREATE INDEX transactions_asset_payments ON transactions USING GIN ((asset->'payments')) WITH (fastupdate = off);
        `);
    }
}
