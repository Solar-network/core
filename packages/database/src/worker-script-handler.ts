import { Identities } from "@solar-network/crypto";
import { Contracts, Utils as AppUtils } from "@solar-network/kernel";
import Database from "better-sqlite3";
import { decode, encode } from "bs58";
import { ensureFileSync, existsSync, readdirSync, statSync } from "fs-extra";
import { parentPort } from "worker_threads";

export class WorkerScriptHandler implements Contracts.Database.WorkerScriptHandler {
    private database!: Database.Database;
    private metadata: Map<string, string> = new Map();

    public start(): void {
        const databasePath: string = `${process.env.SOLAR_CORE_PATH_DATA}/database/blockchain.db`;
        ensureFileSync(databasePath);
        this.database = new Database(databasePath, { timeout: 30000 });
        this.database.defaultSafeIntegers(true);
        this.database.pragma("auto_vacuum = incremental");
        this.database.pragma("cache_size = 32768");
        this.database.pragma("journal_mode = wal");
        this.database.pragma("page_size = 32768");
        this.database.pragma("synchronous = normal");
        this.database.pragma("temp_store = memory");

        const modelsDirectory: string = `${__dirname}/models/`;

        const files = readdirSync(modelsDirectory).filter((file) => {
            const fullPath: string = modelsDirectory + file;
            return fullPath.endsWith("model.js") && existsSync(fullPath) && statSync(fullPath).isFile();
        });

        for (const file of files) {
            const model = new (Object.values(require(modelsDirectory + file))[0] as any)();
            const metadataProps: string[] = Reflect.getOwnMetadata("props", model.constructor);
            if (metadataProps) {
                for (const metadata of metadataProps) {
                    this.metadata.set(metadata, Reflect.getMetadata("type", model, metadata));
                    this.metadata.set(AppUtils.snakeCase(metadata)!, Reflect.getMetadata("type", model, metadata));
                }
            }
        }
    }

    public async transaction(
        queries: Contracts.Database.DatabaseTransaction[],
        enforceForeignKeys: boolean = true,
        id?: string,
    ): Promise<void> {
        if (enforceForeignKeys) {
            this.database.pragma("foreign_keys = on");
        } else {
            this.database.pragma("foreign_keys = off");
        }
        this.database.prepare("BEGIN TRANSACTION").run();
        for (const sqlQuery of queries) {
            let query: string;
            let parameters: Record<string, any> | undefined;
            if (typeof sqlQuery === "string") {
                query = sqlQuery;
            } else {
                ({ query } = sqlQuery);
                parameters = sqlQuery.parameters;
            }
            try {
                this.execute(query, parameters);
            } catch (error) {
                this.database.prepare("ROLLBACK").run();
                this.database.pragma("foreign_keys = on");
                parentPort!.postMessage({
                    id,
                    error: `${error.message} (transaction query: ${query}, parameters: ${JSON.stringify(parameters)})`,
                });
                return;
            }
        }
        this.database.prepare("COMMIT").run();
        this.database.pragma("foreign_keys = on");
        parentPort!.postMessage({ id, result: "ok" });
    }

    public checkpoint(): void {
        this.database.pragma("incremental_vacuum");
        this.database.pragma("wal_checkpoint(truncate)");
    }

    public async pragma(pragma: string, id?: string): Promise<void> {
        try {
            const result = this.database.pragma(pragma, { simple: true });
            parentPort!.postMessage!({ id, result });
        } catch (error) {
            parentPort!.postMessage!({
                id,
                error: `${error.message} (pragma: ${pragma})`,
            });
        }
    }

    public async query(sql: string, parameters?: Record<string, any>, id?: string): Promise<void> {
        try {
            const result = this.execute(sql, parameters);
            parentPort!.postMessage!({ id, result });
        } catch (error) {
            parentPort!.postMessage!({
                id,
                error: `${error.message} (query: ${sql}, parameters: ${JSON.stringify(parameters)})`,
            });
        }
    }

    private execute(sql: string, parameters?: Record<string, any>): string | any[] {
        if (!parameters) {
            parameters = {};
        } else {
            parameters = this.transformFromModel(parameters);
        }

        for (const [key, value] of Object.entries(parameters)) {
            if (typeof value === "object" && value !== null && value.type === "Buffer") {
                parameters[key] = Buffer.from(value);
            }
        }

        let result: string | any[];
        if (sql.toUpperCase().startsWith("SELECT ")) {
            result = this.transformToModel(this.database.prepare(sql).all(parameters));
        } else {
            if (parameters) {
                this.database.prepare(sql).run(parameters);
            }
            result = "ok";
        }

        return result;
    }

    private transformFromModel(parameters: Record<string, any>): Record<string, any> {
        const cache: Map<string, any> = new Map();
        for (const [key, value] of Object.entries(parameters)) {
            parameters[key] = value;
            const param: string = key.includes("__") ? key.substring(0, key.indexOf("__")) : key;
            if (this.metadata.has(param)) {
                switch (this.metadata.get(param)) {
                    case "base58": {
                        if (!cache.has(value) && value !== undefined && value !== null) {
                            cache.set(value, Buffer.from(decode(value)));
                        }
                        parameters[key] = cache.get(value);
                        break;
                    }
                    case "bignumber": {
                        parameters[key] = value.toString();
                        break;
                    }
                    case "buffer": {
                        if (typeof value !== "string" || !value.endsWith("*")) {
                            parameters[key] = Buffer.from(value, "hex");
                        }
                        break;
                    }
                    case "identity": {
                        if (!cache.has(value) && value !== undefined && value !== null) {
                            if (value.length <= 20) {
                                cache.set(value, Buffer.from(value, "utf8"));
                            } else {
                                cache.set(value, Identities.Address.toBuffer(value).addressBuffer);
                            }
                        }
                        parameters[key] = cache.get(value);
                        break;
                    }
                }
            }
        }
        return parameters;
    }

    private transformToModel(rows: Record<string, any>[]): Record<string, any>[] {
        const cache: Map<string, any> = new Map();
        return rows.map((row) => {
            for (const [key, value] of Object.entries(row)) {
                row[key] = value;
                if (typeof value === "object" && value !== null) {
                    if (this.metadata.has(key)) {
                        switch (this.metadata.get(key)) {
                            case "base58": {
                                const string: string = value.toString("hex");
                                if (!cache.has(string) && value !== undefined && value !== null) {
                                    cache.set(string, encode(value));
                                }
                                row[key] = cache.get(string);
                                break;
                            }
                            case "buffer": {
                                row[key] = value.toString("hex");
                                break;
                            }
                            case "identity": {
                                const string: string = value.toString("hex");
                                if (!cache.has(string) && value !== undefined && value !== null) {
                                    if (value.length === 21) {
                                        cache.set(string, Identities.Address.fromBuffer(value));
                                    } else {
                                        cache.set(string, value.toString("utf8"));
                                    }
                                }
                                row[key] = cache.get(string);
                                break;
                            }
                        }
                    }
                } else if (this.metadata.get(key) !== "bignumber" && typeof value === "bigint") {
                    row[key] = Number(value);
                }
            }
            return row;
        });
    }
}
