import { Container, Contracts, Providers } from "@solar-network/kernel";
import BetterSqlite3 from "better-sqlite3";
import { ensureFileSync, existsSync, unlinkSync } from "fs-extra";

@Container.injectable()
export class Storage implements Contracts.Pool.Storage {
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/pool")
    private readonly configuration!: Providers.PluginConfiguration;

    private database!: BetterSqlite3.Database;
    private addTransactionStmt!: BetterSqlite3.Statement<Contracts.Pool.StoredTransaction>;
    private hasTransactionStmt!: BetterSqlite3.Statement<{ id: string }>;
    private getAllTransactionsStmt!: BetterSqlite3.Statement<never[]>;
    private getOldTransactionsStmt!: BetterSqlite3.Statement<{ height: number }>;
    private removeTransactionStmt!: BetterSqlite3.Statement<{ id: string }>;
    private flushStmt!: BetterSqlite3.Statement<never[]>;

    public boot(): void {
        const clearLock: string = `${process.env.SOLAR_CORE_PATH_TEMP}/clear-pool.lock`;
        const filename = this.configuration.getRequired<string>("storage");

        if (existsSync(clearLock)) {
            try {
                unlinkSync(clearLock);
            } catch {
                //
            }

            const poolFiles = [filename, `${filename}-shm`, `${filename}-wal`];

            try {
                for (const file of poolFiles) {
                    unlinkSync(file);
                }
            } catch {
                //
            }
        }

        ensureFileSync(filename);

        this.database = new BetterSqlite3(filename);
        const dbName = "pool_20221010";

        this.database.pragma("auto_vacuum = incremental");
        this.database.pragma("cache_size = 32768");
        this.database.pragma("journal_mode = wal");
        this.database.pragma("page_size = 32768");
        this.database.pragma("synchronous = normal");
        this.database.pragma("temp_store = memory");

        this.database.exec(`
            CREATE TABLE IF NOT EXISTS ${dbName} (
                id TEXT PRIMARY KEY,
                height INTEGER NOT NULL,
                recipientId TEXT NOT NULL,
                senderId TEXT NOT NULL,
                serialised BLOB NOT NULL
            ) STRICT`);

        this.database.exec(`CREATE INDEX IF NOT EXISTS index_${dbName}_height ON ${dbName} (height)`);

        this.addTransactionStmt = this.database.prepare(
            `INSERT INTO ${dbName} (height, id, recipientId, senderId, serialised) VALUES (:height, :id, :recipientId, :senderId, :serialised)`,
        );

        this.hasTransactionStmt = this.database.prepare(`SELECT count(id) FROM ${dbName} WHERE id = :id`).pluck(true);

        this.getAllTransactionsStmt = this.database.prepare(
            `SELECT height, id, recipientId, senderId, serialised FROM ${dbName} ORDER BY rowid`,
        );

        this.getOldTransactionsStmt = this.database.prepare(
            `SELECT id, senderId FROM ${dbName} WHERE height <= :height ORDER BY rowid DESC`,
        );

        this.removeTransactionStmt = this.database.prepare(`DELETE FROM ${dbName} WHERE id = :id`);

        this.flushStmt = this.database.prepare(`DELETE FROM ${dbName}`);
    }

    public dispose(): void {
        this.database.close();
    }

    public addTransaction(storedTransaction: Contracts.Pool.StoredTransaction): void {
        this.addTransactionStmt.run(storedTransaction);
    }

    public hasTransaction(id: string): boolean {
        return !!this.hasTransactionStmt.get({ id });
    }

    public getAllTransactions(): Iterable<Contracts.Pool.StoredTransaction> {
        return this.getAllTransactionsStmt.all();
    }

    public getOldTransactions(height: number): Iterable<Contracts.Pool.StoredTransaction> {
        return this.getOldTransactionsStmt.all({ height });
    }

    public removeTransaction(id: string): void {
        this.removeTransactionStmt.run({ id });
    }

    public flush(): void {
        this.flushStmt.run();
    }
}
