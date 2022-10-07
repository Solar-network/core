import { BurnBuilder } from "./transactions/burn";
import { DelegateRegistrationBuilder } from "./transactions/delegate-registration";
import { DelegateResignationBuilder } from "./transactions/delegate-resignation";
import { ExtraSignatureBuilder } from "./transactions/extra-signature";
import { IPFSBuilder } from "./transactions/ipfs";
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

    public static delegateRegistration(): DelegateRegistrationBuilder {
        return new DelegateRegistrationBuilder();
    }

    public static ipfs(): IPFSBuilder {
        return new IPFSBuilder();
    }

    public static multiPayment(): TransferBuilder {
        return new TransferBuilder();
    }

    public static delegateResignation(): DelegateResignationBuilder {
        return new DelegateResignationBuilder();
    }

    public static burn(): BurnBuilder {
        return new BurnBuilder();
    }

    public static vote(): VoteBuilder {
        return new VoteBuilder();
    }
}
