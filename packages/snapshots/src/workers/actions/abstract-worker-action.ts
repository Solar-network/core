import { Container, Contracts } from "@solar-network/kernel";
import { singular } from "pluralize";
import { Readable } from "stream";
import { pascalize as pascalise } from "xcase";

import { Codec, Repository, RepositoryFactory, Stream, Worker } from "../../contracts";
import { StreamReader, StreamWriter } from "../../filesystem";
import { Identifiers } from "../../ioc";
import { Verifier } from "../../verifier";

@Container.injectable()
export abstract class AbstractWorkerAction implements Worker.WorkerAction {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    protected table?: string;
    protected codec?: string;
    protected skipCompression?: boolean;
    protected filePath?: string;
    protected updateStep?: number;

    protected options?: Worker.ActionOptions;

    public init(options: Worker.ActionOptions): void {
        this.table = options.table;
        this.codec = options.codec;
        this.skipCompression = options.skipCompression;
        this.filePath = options.filePath;
        this.updateStep = options.updateStep;

        this.options = options;
    }

    protected getRepository(): Repository {
        const repositoryFactory = this.app.get<RepositoryFactory>(Identifiers.SnapshotRepositoryFactory);

        return repositoryFactory(this.table!);
    }

    protected getSingularCapitalisedTableName(): string {
        return pascalise(singular(this.table));
    }

    protected getStreamReader(): StreamReader {
        const streamReaderFactory = this.app.get<Stream.StreamReaderFactory>(Identifiers.StreamReaderFactory);

        // passing a codec method as last parameter. Example: Codec.decodeBlock
        return streamReaderFactory(
            this.filePath!,
            !this.skipCompression!,
            this.getCodec()[`decode${this.getSingularCapitalisedTableName()}`],
        );
    }

    protected getStreamWriter(dbStream: Readable): StreamWriter {
        const streamWriterFactory = this.app.get<Stream.StreamWriterFactory>(Identifiers.StreamWriterFactory);

        // passing a codec method as last parameter. Example: Codec.decodeBlock
        return streamWriterFactory(
            dbStream,
            this.filePath!,
            !this.skipCompression!,
            this.getCodec()[`encode${this.getSingularCapitalisedTableName()}`],
        );
    }

    protected getCodec(): Codec {
        return this.app.getTagged<Codec>(Identifiers.SnapshotCodec, "codec", this.codec);
    }

    protected getVerifyFunction(): Function {
        // passing a codec method as last parameter. Example: Verifier.verifyBlock
        return Verifier[`verify${this.getSingularCapitalisedTableName()}`];
    }

    public abstract start(): Promise<void>;

    public abstract sync(data: Worker.WorkerSyncData): void;
}
