import { parentPort } from "worker_threads";

type Actions<T extends {}> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? (ReturnType<T[K]> extends void ? K : never) : never;
}[keyof T];

type Requests<T extends {}> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? (ReturnType<T[K]> extends Promise<any> ? K : never) : never;
}[keyof T];

export class WorkerHandler<T> {
    private readonly handler: T;

    public constructor(handler: T) {
        this.handler = handler;
    }

    public handleAction<K extends Actions<T>>(method: K): void {
        if (parentPort) {
            parentPort.on("message", (message: { method: string; args: any }) => {
                if (message.method === method) {
                    this.handler[method](...message.args);
                }
            });
        }
    }

    public handleRequest<K extends Requests<T>>(method: K): void {
        if (parentPort) {
            parentPort.on("message", (message: { method: string; id: string; args: any }) => {
                if (message.method === method) {
                    this.handler[method](...message.args, message.id);
                }
            });
        }
    }
}
