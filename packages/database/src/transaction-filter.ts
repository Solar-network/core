import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { TransactionModel } from "./models";

const { handleAndCriteria, handleOrCriteria, handleNumericCriteria, optimiseExpression } = AppUtils.Search;

@Container.injectable()
export class TransactionFilter implements Contracts.Database.TransactionFilter {
    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async getExpression(
        ...criteria: Contracts.Shared.OrTransactionCriteria[]
    ): Promise<Contracts.Search.Expression<Partial<TransactionModel>>> {
        const expressions = await Promise.all(
            criteria.map((c) => handleOrCriteria(c, (c) => this.handleTransactionCriteria(c))),
        );

        return optimiseExpression({ op: "and", expressions });
    }

    private async handleTransactionCriteria(
        criteria: Contracts.Shared.TransactionCriteria,
    ): Promise<Contracts.Search.Expression<TransactionModel>> {
        const expression: Contracts.Search.Expression<TransactionModel> = await handleAndCriteria(
            criteria,
            async (key) => {
                switch (key) {
                    case "address": {
                        return handleOrCriteria(criteria.address!, async (c) => {
                            return this.handleAddressCriteria(c);
                        });
                    }
                    case "senderId": {
                        return handleOrCriteria(criteria.senderId!, async (c) => {
                            return this.handleSenderIdCriteria(c);
                        });
                    }
                    case "recipientId": {
                        return handleOrCriteria(criteria.recipientId!, async (c) => {
                            return this.handleRecipientIdCriteria(c);
                        });
                    }
                    case "id": {
                        return handleOrCriteria(criteria.id!, async (c) => {
                            return { property: "id", op: "like", pattern: c + "*" };
                        });
                    }
                    case "version": {
                        return handleOrCriteria(criteria.version!, async (c) => {
                            return { property: "version", op: "equal", value: c };
                        });
                    }
                    case "blockHeight": {
                        return handleOrCriteria(criteria.blockHeight!, async (c) => {
                            return handleNumericCriteria("blockHeight", c);
                        });
                    }
                    case "sequence": {
                        return handleOrCriteria(criteria.sequence!, async (c) => {
                            return handleNumericCriteria("sequence", c);
                        });
                    }
                    case "timestamp": {
                        return handleOrCriteria(criteria.timestamp!, async (c) => {
                            return handleNumericCriteria("timestamp", c);
                        });
                    }
                    case "nonce": {
                        return handleOrCriteria(criteria.nonce!, async (c) => {
                            return handleNumericCriteria("nonce", c);
                        });
                    }
                    case "senderPublicKey": {
                        return handleOrCriteria(criteria.senderPublicKey!, async (c) => {
                            return { property: "senderPublicKey", op: "equal", value: c };
                        });
                    }
                    case "type": {
                        return handleOrCriteria(criteria.type!, async (c) => {
                            return { property: "type", op: "equal", value: c };
                        });
                    }
                    case "memo": {
                        return handleOrCriteria(criteria.memo!, async (c) => {
                            return { property: "memo", op: "like", pattern: c };
                        });
                    }
                    case "amount": {
                        return handleOrCriteria(criteria.vote!, async (c) => {
                            return {
                                property: "amount",
                                op: "amount",
                                received: criteria.amount!.received,
                                sent: criteria.amount!.sent,
                            };
                        });
                    }
                    case "fee": {
                        return handleOrCriteria(criteria.fee!, async (c) => {
                            return handleNumericCriteria("fee", c);
                        });
                    }
                    case "extraSignature": {
                        return handleOrCriteria(criteria.extraSignature!, async (c) => {
                            return { property: "signature", op: "equal", value: c };
                        });
                    }
                    case "registration": {
                        return handleOrCriteria(criteria.registration!, async (c) => {
                            return { property: "username", op: "equal", value: c };
                        });
                    }
                    case "vote": {
                        return handleOrCriteria(criteria.vote!, async (c) => {
                            return {
                                property: "vote",
                                op: "vote",
                                percent: criteria.vote!.percent,
                                username: criteria.vote!.username,
                            };
                        });
                    }
                    case "ipfsHash": {
                        return handleOrCriteria(criteria.ipfsHash!, async (c) => {
                            return { property: "hash", op: "equal", value: c };
                        });
                    }
                    case "resignation": {
                        return handleOrCriteria(criteria.resignation!, async (c) => {
                            return { property: "resignation", op: "equal", value: c };
                        });
                    }
                    default:
                        return { op: "true" };
                }
            },
        );

        return { op: "and", expressions: [expression] };
    }

    private async handleAddressCriteria(
        criteria: Contracts.Search.EqualCriteria<string>,
    ): Promise<Contracts.Search.Expression<TransactionModel>> {
        const expressions: Contracts.Search.Expression<TransactionModel>[] = await Promise.all([
            this.handleSenderIdCriteria(criteria),
            this.handleRecipientIdCriteria(criteria),
        ]);

        return { op: "or", expressions };
    }

    private async handleSenderIdCriteria(
        criteria: Contracts.Search.EqualCriteria<string>,
    ): Promise<Contracts.Search.Expression<TransactionModel>> {
        if (this.walletRepository.hasByAddress(criteria)) {
            const senderWallet = this.walletRepository.findByAddress(criteria);
            return { op: "equal", property: "senderId", value: senderWallet.getAddress() };
        }

        return { op: "false" };
    }

    private async handleRecipientIdCriteria(
        criteria: Contracts.Search.EqualCriteria<string>,
    ): Promise<Contracts.Search.Expression<TransactionModel>> {
        const transferRecipientIdExpression: Contracts.Search.AndExpression<TransactionModel> = {
            op: "and",
            expressions: [
                { op: "equal", property: "type", value: "transfer" },
                { op: "equal", property: "recipientId", value: criteria },
            ],
        };

        return {
            op: "or",
            expressions: [transferRecipientIdExpression],
        };
    }
}
