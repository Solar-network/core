import { WorkerThread as AppUtilsWorkerThread } from "../../utils/worker-thread";
import { DatabaseTransaction } from "./migration";

export interface WorkerScriptHandler {
    checkpoint(): void;
    pragma(pragma: string, id?: string): Promise<any>;
    query(sql: string, parameters?: Record<string, any>): Promise<void>;
    start(): void;
    transaction(queries: DatabaseTransaction[], enforceForeignKeys: boolean): Promise<void>;
}

export type WorkerThread = AppUtilsWorkerThread<WorkerScriptHandler>;

export type WorkerThreadFactory = () => WorkerThread;

export interface Worker {
    checkpoint(): void;
    getQueueSize(): number;
    pragma(pragma: string): Promise<any>;
    query(sql: string, parameters?: Record<string, any>): Promise<any[]>;
    start(): void;
    transaction(queries: DatabaseTransaction[], enforceForeignKeys: boolean): Promise<void>;
}

export type WorkerFactory = () => Worker;

export interface QueryRunner {
    checkpoint(): void;
    maintenance(): Promise<void>;
    query(sql: string, parameters?: Record<string, any>): Promise<any[]>;
    transaction(queries: DatabaseTransaction[], enforceForeignKeys?: boolean): Promise<void>;
}
