import {
    Hash256,
    Keccak256,
    Keccak384,
    Keccak512,
    RIPEMD160,
    SHA3_256,
    SHA3_384,
    SHA3_512,
    SHA256,
    SHA384,
    SHA512,
} from "bcrypto";

export class HashAlgorithms {
    public static ripemd160(buff: Buffer | string): Buffer {
        return RIPEMD160.digest(this.bufferize(buff));
    }

    public static keccak256(buff: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buff, Keccak256);
    }

    public static keccak384(buff: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buff, Keccak384);
    }

    public static keccak512(buff: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buff, Keccak512);
    }

    public static sha256(buff: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buff, SHA256);
    }

    public static sha384(buff: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buff, SHA384);
    }

    public static sha512(buff: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buff, SHA512);
    }

    public static sha3256(buff: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buff, SHA3_256);
    }

    public static sha3384(buff: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buff, SHA3_384);
    }

    public static sha3512(buff: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buff, SHA3_512);
    }

    public static hash256(buff: Buffer | string): Buffer {
        return Hash256.digest(this.bufferize(buff));
    }

    private static bufferize(buff: Buffer | string) {
        return buff instanceof Buffer ? buff : Buffer.from(buff);
    }

    private static hash(buff: Buffer | string | Buffer[], hasher: any): Buffer {
        if (Array.isArray(buff)) {
            let hasherCtx = hasher.ctx;

            hasherCtx.init();

            for (const element of buff) {
                hasherCtx = hasherCtx.update(element);
            }

            return hasherCtx.final();
        }

        return hasher.digest(this.bufferize(buff));
    }
}
