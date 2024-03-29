import { Managers } from "@solar-network/crypto";
import { Models, Utils } from "@solar-network/database";
import { Container } from "@solar-network/kernel";
import { Readable } from "stream";
import { Connection, createConnection, getCustomRepository } from "typeorm";
import { parentPort, workerData } from "worker_threads";

import * as Codecs from "../codecs";
import { StreamReader, StreamWriter } from "../codecs";
import { Repository, Worker } from "../contracts";
import { Identifiers } from "../ioc";
import * as Repositories from "../repositories";
import * as Actions from "./actions";
import { Application } from "./application";

let app: Application;
let action: Worker.WorkerAction;
const _workerData: Worker.WorkerData = workerData;

const connect = async (options: any): Promise<Connection> => {
    return createConnection({
        ...options.connection,
        namingStrategy: new Utils.SnakeNamingStrategy(),
        entities: [Models.Block, Models.MissedBlock, Models.Transaction, Models.Round],
    });
};

export const init = async (): Promise<void> => {
    Managers.configManager.setConfig(_workerData.networkConfig);

    app = new Application(new Container.Container());

    if (_workerData.connection) {
        app.bind(Identifiers.SnapshotDatabaseConnection).toConstantValue(
            await connect({ connection: _workerData.connection }),
        );
    }

    app.bind(Identifiers.SnapshotRepositoryFactory).toFactory<Repository>(() => (table: string) => {
        switch (table) {
            case "blocks": {
                return getCustomRepository(Repositories.BlockRepository);
            }
            case "missedBlocks": {
                return getCustomRepository(Repositories.MissedBlockRepository);
            }
            case "transactions": {
                return getCustomRepository(Repositories.TransactionRepository);
            }
            default: {
                return getCustomRepository(Repositories.RoundRepository);
            }
        }
    });

    app.bind<StreamReader>(Identifiers.StreamReaderFactory).toFactory<StreamReader>(
        () => (path: string, useCompression: boolean, decode: Function) =>
            new StreamReader(path, useCompression, decode),
    );

    app.bind<StreamWriter>(Identifiers.StreamWriterFactory).toFactory<StreamWriter>(
        () => (dbStream: Readable, path: string, useCompression: boolean, encode: Function) =>
            new StreamWriter(dbStream, path, useCompression, encode),
    );

    app.bind(Identifiers.SnapshotCodec)
        .to(Codecs.MessagePackCodec)
        .inSingletonScope()
        .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("codec", "default"));

    app.bind(Identifiers.SnapshotCodec)
        .to(Codecs.JSONCodec)
        .inSingletonScope()
        .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("codec", "json"));

    app.bind(Identifiers.SnapshotAction)
        .to(Actions.DumpWorkerAction)
        .inSingletonScope()
        .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("action", "dump"));

    app.bind(Identifiers.SnapshotAction)
        .to(Actions.RestoreWorkerAction)
        .inSingletonScope()
        .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("action", "restore"));

    app.bind(Identifiers.SnapshotAction)
        .to(Actions.VerifyWorkerAction)
        .inSingletonScope()
        .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("action", "verify"));

    // For testing purposes only
    app.bind(Identifiers.SnapshotAction)
        .to(Actions.TestWorkerAction)
        .inSingletonScope()
        .when(Container.Selectors.anyAncestorOrTargetTaggedFirst("action", "test"));

    action = app.getTagged<Worker.WorkerAction>(Identifiers.SnapshotAction, "action", _workerData.actionOptions.action);

    action.init(workerData.actionOptions);
};

export const dispose = async (): Promise<void> => {
    if (_workerData.connection) {
        const connection = app.get<Connection>(Identifiers.SnapshotDatabaseConnection);

        await connection.close();
    }
};

parentPort?.on("message", async (data: { action: string; data: Worker.WorkerSyncData }) => {
    if (data.action === "start") {
        await init();

        await action.start();

        await dispose();

        process.exit();
    }
    if (data.action === "sync") {
        action.sync(data.data);
    }
});

const handleException = (err: any) => {
    parentPort!.postMessage({
        action: "exception",
        data: err,
    });

    process.exit();
};

process.on("unhandledRejection", (err) => {
    handleException(err);
});

process.on("uncaughtException", (err) => {
    handleException(err);
});

process.on("multipleResolves", (err) => {
    handleException(err);
});
