export interface StateSaver {
    run(): Promise<void>;
}
