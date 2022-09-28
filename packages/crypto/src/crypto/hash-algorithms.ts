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
    public static ripemd160(buf: Buffer | string): Buffer {
        return RIPEMD160.digest(this.bufferise(buf));
    }

    public static keccak256(buf: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buf, Keccak256);
    }

    public static keccak384(buf: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buf, Keccak384);
    }

    public static keccak512(buf: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buf, Keccak512);
    }

    public static sha256(buf: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buf, SHA256);
    }

    public static sha384(buf: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buf, SHA384);
    }

    public static sha512(buf: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buf, SHA512);
    }

    public static sha3256(buf: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buf, SHA3_256);
    }

    public static sha3384(buf: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buf, SHA3_384);
    }

    public static sha3512(buf: Buffer | string | Buffer[]): Buffer {
        return HashAlgorithms.hash(buf, SHA3_512);
    }

    public static hash256(buf: Buffer | string): Buffer {
        return Hash256.digest(this.bufferise(buf));
    }

    private static bufferise(buf: Buffer | string) {
        return buf instanceof Buffer ? buf : Buffer.from(buf);
    }

    private static hash(buf: Buffer | string | Buffer[], hasher: any): Buffer {
        if (Array.isArray(buf)) {
            let hasherCtx = hasher.ctx;

            hasherCtx.init();

            for (const element of buf) {
                hasherCtx = hasherCtx.update(element);
            }

            return hasherCtx.final();
        }

        return hasher.digest(this.bufferise(buf));
    }
}
