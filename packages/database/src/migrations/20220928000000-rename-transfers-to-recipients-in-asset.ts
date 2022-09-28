import { Enums } from "@solar-network/crypto";
import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameTransfersToRecipientsInAsset20220928000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<any> {
        queryRunner.connection.driver.options.extra.logger.debug(
            "Database migration: Renaming transfers asset to recipients in transactions table",
        );
        await queryRunner.query(`
            UPDATE transactions SET asset = JSONB_SET(asset #- '{transfers}', '{recipients}', asset #> '{transfers}') WHERE type_group = ${Enums.TransactionTypeGroup.Core} AND type = ${Enums.TransactionType.Core.Transfer};
            DROP INDEX transactions_asset_transfers;
            CREATE INDEX transactions_asset_recipients ON transactions USING GIN ((asset->'recipients')) WITH (fastupdate = off);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`
            UPDATE transactions SET asset = JSONB_SET(asset #- '{recipients}', '{transfers}', asset #> '{recipients}') WHERE type_group = ${Enums.TransactionTypeGroup.Core} AND type = ${Enums.TransactionType.Core.Transfer};
            DROP INDEX transactions_asset_recipients;
            CREATE INDEX transactions_asset_transfers ON transactions USING GIN ((asset->'transfers')) WITH (fastupdate = off);
        `);
    }
}
