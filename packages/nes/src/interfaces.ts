export interface NesMessage {
    type?: string; // 0-9
    id?: number;
    path?: string;
    payload?: Buffer | string;
    statusCode?: number;
    method?: string;
    version?: string;
    socket?: string;
    heartbeat?: {
        interval?: number;
        timeout?: number;
    };
}
