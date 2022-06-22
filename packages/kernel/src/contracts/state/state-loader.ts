export interface StateLoader {
    run(): Promise<boolean>;
}
