import { BurnBuilder } from "./transactions/burn";
import { ExtraSignatureBuilder } from "./transactions/extra-signature";
import { IPFSBuilder } from "./transactions/ipfs";
import { RegistrationBuilder } from "./transactions/registration";
import { ResignationBuilder } from "./transactions/resignation";
import { TransferBuilder } from "./transactions/transfer";
import { VoteBuilder } from "./transactions/vote";

export * from "./transactions/transaction";

export class BuilderFactory {
    public static transfer(): TransferBuilder {
        return new TransferBuilder();
    }

    public static extraSignature(): ExtraSignatureBuilder {
        return new ExtraSignatureBuilder();
    }

    public static registration(): RegistrationBuilder {
        return new RegistrationBuilder();
    }

    public static ipfs(): IPFSBuilder {
        return new IPFSBuilder();
    }

    public static resignation(): ResignationBuilder {
        return new ResignationBuilder();
    }

    public static burn(): BurnBuilder {
        return new BurnBuilder();
    }

    public static vote(): VoteBuilder {
        return new VoteBuilder();
    }
}
