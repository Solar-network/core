import { Worker } from "worker_threads";

type Actions<T extends {}> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? (ReturnType<T[K]> extends void ? K : never) : never;
}[keyof T];

type Requests<T extends {}> = {
    [K in keyof T]: T[K] extends (...args: any[]) => any ? (ReturnType<T[K]> extends Promise<any> ? K : never) : never;
}[keyof T];

type SuccessReply = {
    id: number;
    result: any;
};

type ErrorReply = {
    id: number;
    error: string;
};

type Reply = SuccessReply | ErrorReply;

type RequestCallback<T, K extends Requests<T>> = {
    resolve: (result: ReturnType<T[K]>) => void;
    reject: (error: Error) => void;
};

type RequestCallbacks<T> = RequestCallback<T, Requests<T>>;

export class WorkerThread<T> {
    private lastId = 1;
    private readonly worker: Worker;
    private readonly callbacks = new Map<number, RequestCallbacks<T>>();

    public constructor(worker: Worker) {
        this.worker = worker;
        this.worker.on("message", this.onWorkerMessage.bind(this));
    }

    public getQueueSize(): number {
        return this.callbacks.size;
    }

    public sendAction<K extends Actions<T>>(method: K, ...args: Parameters<T[K]>): void {
        this.worker.postMessage({ method, args });
    }

    public sendRequest<K extends Requests<T>>(method: K, ...args: Parameters<T[K]>): Promise<any> {
        return new Promise((resolve, reject) => {
            const id = this.lastId++;
            this.callbacks.set(id, { resolve, reject });
            this.worker.postMessage({ id, method, args });
        });
    }

    private onWorkerMessage(message: Reply): void {
        try {
            if ("error" in message) {
                this.callbacks.get(message.id)?.reject(new Error(message.error));
            } else {
                this.callbacks.get(message.id)?.resolve(message.result);
            }
        } finally {
            this.callbacks.delete(message.id);
        }
    }
}
