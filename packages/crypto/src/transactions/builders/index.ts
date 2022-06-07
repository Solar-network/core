import { configManager } from "../../managers";
import { DelegateRegistrationBuilder } from "./transactions/core/delegate-registration";
import { DelegateResignationBuilder } from "./transactions/core/delegate-resignation";
import { HtlcClaimBuilder } from "./transactions/core/htlc-claim";
import { HtlcLockBuilder } from "./transactions/core/htlc-lock";
import { HtlcRefundBuilder } from "./transactions/core/htlc-refund";
import { IPFSBuilder } from "./transactions/core/ipfs";
import { MultiPaymentBuilder } from "./transactions/core/multi-payment";
import { MultiSignatureBuilder } from "./transactions/core/multi-signature";
import { SecondSignatureBuilder } from "./transactions/core/second-signature";
import { TransferBuilder } from "./transactions/core/transfer";
import { VoteBuilder as LegacyVoteBuilder } from "./transactions/core/vote";
import { BurnBuilder } from "./transactions/solar/burn";
import { VoteBuilder } from "./transactions/solar/vote";

export * from "./transactions/transaction";

export class BuilderFactory {
    public static transfer(): TransferBuilder {
        return new TransferBuilder();
    }

    public static secondSignature(): SecondSignatureBuilder {
        return new SecondSignatureBuilder();
    }

    public static delegateRegistration(): DelegateRegistrationBuilder {
        return new DelegateRegistrationBuilder();
    }

    public static multiSignature(): MultiSignatureBuilder {
        return new MultiSignatureBuilder();
    }

    public static ipfs(): IPFSBuilder {
        return new IPFSBuilder();
    }

    public static multiPayment(): MultiPaymentBuilder {
        return new MultiPaymentBuilder();
    }

    public static delegateResignation(): DelegateResignationBuilder {
        return new DelegateResignationBuilder();
    }

    public static htlcLock(): HtlcLockBuilder {
        return new HtlcLockBuilder();
    }

    public static htlcClaim(): HtlcClaimBuilder {
        return new HtlcClaimBuilder();
    }

    public static htlcRefund(): HtlcRefundBuilder {
        return new HtlcRefundBuilder();
    }

    public static burn(): BurnBuilder {
        return new BurnBuilder();
    }

    public static vote(): LegacyVoteBuilder | VoteBuilder {
        if (configManager.getMilestone().legacyVote) {
            return new LegacyVoteBuilder();
        }

        return new VoteBuilder();
    }
}
