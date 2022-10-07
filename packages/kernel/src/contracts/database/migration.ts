export interface MigrationClass {
    new (): Migration;
}
export interface Migration {
    description: string;
    migrate(QueryRunner): Promise<void>;
}

export type DatabaseTransaction = string | { query: string; parameters?: Record<string, any> };
