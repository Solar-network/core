import { Container, Contracts, Utils } from "@solar-network/kernel";
import { existsSync, readdirSync, statSync } from "fs";

import { MigrationModel } from "../models";
import { Repository } from "./repository";

@Container.injectable()
export class MigrationRepository extends Repository<MigrationModel> implements Contracts.Database.MigrationRepository {
    public async performMigrations() {
        const existingMigrations: string[] = [];
        try {
            existingMigrations.push(
                ...(await this.createQueryBuilder().select("name").from("migrations").run()).map(
                    (migration) => migration.name,
                ),
            );
        } catch {
            //
        }

        const migrationsDirectory: string = `${__dirname}/../migrations/`;
        const migrationsToRun: { name: string; Migration: Contracts.Database.MigrationClass }[] = [];

        const files = readdirSync(migrationsDirectory)
            .filter((file) => {
                const fullPath: string = migrationsDirectory + file;
                return fullPath.endsWith(".js") && existsSync(fullPath) && statSync(fullPath).isFile();
            })
            .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

        for (const file of files) {
            const migration: Contracts.Database.Migration = require(migrationsDirectory + file);
            const [migrationName, migrationClass]: [
                migrationName: string,
                migrationClass: Contracts.Database.MigrationClass,
            ] = Object.entries(migration).pop()!;
            if (!existingMigrations.includes(migrationName)) {
                migrationsToRun.push({ name: migrationName, Migration: migrationClass });
            }
        }

        if (migrationsToRun.length > 0) {
            this.logger.info(`Performing ${Utils.pluralise("database migration", migrationsToRun.length, true)}`, "🗃️");
        }

        for (let i = 0; i < migrationsToRun.length; i++) {
            const { name, Migration } = migrationsToRun[i];
            const migration = new Migration();
            this.logger.debug(
                `Database migration - Step ${1 + i} of ${migrationsToRun.length}: ${migration.description}`,
                "🗂️",
            );
            await migration.migrate(this.queryRunner);

            await this.createQueryBuilder()
                .insert("timestamp", { timestamp: Math.floor(Date.now() / 1000) })
                .insert("name", { name })
                .into("migrations")
                .run();
        }
    }
}
