import { Exceptions } from "@solar-network/kernel";

export class StreamNotOpen extends Exceptions.Base.Exception {
    public constructor(file: string) {
        super(`Stream file file ${file} is not open`);
    }
}

export class EndOfFile extends Exceptions.Base.Exception {
    public constructor(file: string) {
        super(`End of file`);
    }
}
