import { Enums } from "@solar-network/crypto";
import { Container, Contracts, Utils as AppUtils } from "@solar-network/kernel";

import { Transaction } from "./models/transaction";

const { handleAndCriteria, handleOrCriteria, handleNumericCriteria, optimiseExpression, hasOrCriteria } =
    AppUtils.Search;

@Container.injectable()
export class TransactionFilter implements Contracts.Database.TransactionFilter {
    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async getExpression(
        ...criteria: Contracts.Shared.OrTransactionCriteria[]
    ): Promise<Contracts.Search.Expression<Transaction>> {
        const expressions = await Promise.all(
            criteria.map((c) => handleOrCriteria(c, (c) => this.handleTransactionCriteria(c))),
        );

        return optimiseExpression({ op: "and", expressions });
    }

    private async handleTransactionCriteria(
        criteria: Contracts.Shared.TransactionCriteria,
    ): Promise<Contracts.Search.Expression<Transaction>> {
        const expression: Contracts.Search.Expression<Transaction> = await handleAndCriteria(criteria, async (key) => {
            switch (key) {
                case "address":
                    return handleOrCriteria(criteria.address!, async (c) => {
                        return this.handleAddressCriteria(c);
                    });
                case "senderId":
                    return handleOrCriteria(criteria.senderId!, async (c) => {
                        return this.handleSenderIdCriteria(c);
                    });
                case "recipientId":
                    return handleOrCriteria(criteria.recipientId!, async (c) => {
                        return this.handleRecipientIdCriteria(c);
                    });
                case "id":
                    return handleOrCriteria(criteria.id!, async (c) => {
                        return { property: "id", op: "like", pattern: c + "%" };
                    });
                case "version":
                    return handleOrCriteria(criteria.version!, async (c) => {
                        return { property: "version", op: "equal", value: c };
                    });
                case "blockHeight":
                    return handleOrCriteria(criteria.blockHeight!, async (c) => {
                        return handleNumericCriteria("blockHeight", c);
                    });
                case "blockId":
                    return handleOrCriteria(criteria.blockId!, async (c) => {
                        return { property: "blockId", op: "equal", value: c };
                    });
                case "sequence":
                    return handleOrCriteria(criteria.sequence!, async (c) => {
                        return handleNumericCriteria("sequence", c);
                    });
                case "timestamp":
                    return handleOrCriteria(criteria.timestamp!, async (c) => {
                        return handleNumericCriteria("timestamp", c);
                    });
                case "nonce":
                    return handleOrCriteria(criteria.nonce!, async (c) => {
                        return handleNumericCriteria("nonce", c);
                    });
                case "senderPublicKey":
                    return handleOrCriteria(criteria.senderPublicKey!, async (c) => {
                        return { property: "senderPublicKey", op: "equal", value: c };
                    });
                case "type":
                    return handleOrCriteria(criteria.type!, async (c) => {
                        return { property: "type", op: "equal", value: c };
                    });
                case "typeGroup":
                    return handleOrCriteria(criteria.typeGroup!, async (c) => {
                        return { property: "typeGroup", op: "equal", value: c };
                    });
                case "memo":
                    return handleOrCriteria(criteria.memo!, async (c) => {
                        return { property: "memo", op: "like", pattern: Buffer.from(c, "utf-8") };
                    });
                case "amount":
                    return handleOrCriteria(criteria.amount!, async (c) => {
                        return handleNumericCriteria("amount", c);
                    });
                case "fee":
                    return handleOrCriteria(criteria.fee!, async (c) => {
                        return handleNumericCriteria("fee", c);
                    });
                case "burnedFee":
                    return handleOrCriteria(criteria.burnedFee!, async (c) => {
                        return handleNumericCriteria("burnedFee", c);
                    });
                case "asset":
                    return handleOrCriteria(criteria.asset!, async (c) => {
                        return this.handleAssetCriteria(c);
                    });
                default:
                    return { op: "true" };
            }
        });

        return { op: "and", expressions: [expression, await this.getAutoTypeGroupExpression(criteria)] };
    }

    private async handleAddressCriteria(
        criteria: Contracts.Search.EqualCriteria<string>,
    ): Promise<Contracts.Search.Expression<Transaction>> {
        const expressions: Contracts.Search.Expression<Transaction>[] = await Promise.all([
            this.handleSenderIdCriteria(criteria),
            this.handleRecipientIdCriteria(criteria),
        ]);

        return { op: "or", expressions };
    }

    private async handleSenderIdCriteria(
        criteria: Contracts.Search.EqualCriteria<string>,
    ): Promise<Contracts.Search.Expression<Transaction>> {
        if (this.walletRepository.hasByAddress(criteria)) {
            const senderWallet = this.walletRepository.findByAddress(criteria);
            return { op: "equal", property: "senderId", value: senderWallet.getAddress() };
        }

        return { op: "false" };
    }

    private async handleRecipientIdCriteria(
        criteria: Contracts.Search.EqualCriteria<string>,
    ): Promise<Contracts.Search.Expression<Transaction>> {
        const recipientIdExpression: Contracts.Search.EqualExpression<Transaction> = {
            op: "equal",
            property: "recipientId" as keyof Transaction,
            value: criteria,
        };

        const transferRecipientIdExpression: Contracts.Search.AndExpression<Transaction> = {
            op: "and",
            expressions: [
                { op: "equal", property: "typeGroup", value: Enums.TransactionTypeGroup.Core },
                { op: "equal", property: "type", value: Enums.TransactionType.Core.Transfer },
                { op: "contains", property: "asset", value: { transfers: [{ recipientId: criteria }] } },
            ],
        };

        if (this.walletRepository.hasByAddress(criteria)) {
            const recipientWallet = this.walletRepository.findByAddress(criteria);
            const delegateRegistrationExpression: Contracts.Search.AndExpression<Transaction> = {
                op: "and",
                expressions: [
                    { op: "equal", property: "typeGroup", value: Enums.TransactionTypeGroup.Core },
                    { op: "equal", property: "type", value: Enums.TransactionType.Core.DelegateRegistration },
                    { op: "equal", property: "senderId", value: recipientWallet.getAddress() },
                ],
            };

            return {
                op: "or",
                expressions: [recipientIdExpression, transferRecipientIdExpression, delegateRegistrationExpression],
            };
        }
        return {
            op: "or",
            expressions: [recipientIdExpression, transferRecipientIdExpression],
        };
    }

    private async handleAssetCriteria(
        criteria: Contracts.Shared.TransactionCriteria,
    ): Promise<Contracts.Search.Expression<Transaction>> {
        let castLimit = 5;

        const getCastValues = (value: unknown): unknown[] => {
            if (Array.isArray(value)) {
                let castValues: Array<unknown>[] = [[]];

                for (const item of value) {
                    const itemCastValues = getCastValues(item);

                    castValues = castValues.flatMap((castValue) => {
                        return itemCastValues.map((itemCastValue) => {
                            return [...castValue, itemCastValue];
                        });
                    });
                }

                return castValues;
            }

            if (typeof value === "object" && value !== null) {
                let castValues: object[] = [{}];

                for (const key of Object.keys(value)) {
                    const propertyCastValues = getCastValues(value[key]);

                    castValues = castValues.flatMap((castValue) => {
                        return propertyCastValues.map((propertyCastValue) => {
                            return { ...castValue, [key]: propertyCastValue };
                        });
                    });
                }

                return castValues;
            }

            if (typeof value === "string" && String(Number(value)) === value) {
                if (castLimit === 0) {
                    throw new Error("Asset cast property limit reached");
                }
                castLimit--;

                return [value, Number(value)];
            }

            if (value === "true" || value === "false") {
                if (castLimit === 0) {
                    throw new Error("Asset cast property limit reached");
                }
                castLimit--;

                return [value, value === "true"];
            }

            return [value];
        };

        const expressions: Contracts.Search.Expression<Transaction>[] = getCastValues(criteria).map((c) => {
            return { property: "asset", op: "contains", value: c };
        });

        return { op: "or", expressions };
    }

    private async getAutoTypeGroupExpression(
        criteria: Contracts.Shared.TransactionCriteria,
    ): Promise<Contracts.Search.Expression<Transaction>> {
        if (hasOrCriteria(criteria.type) && !hasOrCriteria(criteria.typeGroup)) {
            return { op: "equal", property: "typeGroup", value: Enums.TransactionTypeGroup.Core };
        } else {
            return { op: "true" };
        }
    }
}
