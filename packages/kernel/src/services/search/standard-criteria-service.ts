import { Utils } from "@solar-network/crypto";

import { StandardCriteriaOf, StandardCriteriaOfItem } from "../../contracts/search";
import { injectable } from "../../ioc";
import { Semver } from "../../utils";
import { InvalidCriteria, UnexpectedError, UnsupportedValue } from "./errors";

@injectable()
export class StandardCriteriaService {
    public testStandardCriterias<T>(value: T, ...criterias: StandardCriteriaOf<T>[]): boolean {
        return criterias.every((criteria) => {
            // Criteria is either single criteria item or array of criteria items.

            if (Array.isArray(criteria)) {
                // Array of criteria items constitute OR expression.
                //
                // Example:
                // [
                //   { type: Enums.TransactionType.Core.DelegateRegistration },
                //   { type: Enums.TransactionType.Core.Vote }
                // ]
                //
                // Alternatively (behaves same as above):
                // {
                //   type: [
                //     Enums.TransactionType.Core.DelegateRegistration,
                //     Enums.TransactionType.Core.Vote
                //   ]
                // }

                return criteria.some((criteriaItem, i) => {
                    try {
                        return this.testStandardCriteriaItem(value, criteriaItem);
                    } catch (error) {
                        this.rethrowError(error, String(i));
                    }
                });
            } else {
                return this.testStandardCriteriaItem(value, criteria);
            }
        });
    }

    private testStandardCriteriaItem<T>(value: T, criteriaItem: StandardCriteriaOfItem<T>): boolean {
        if (typeof value === "undefined" || value === null) {
            return false;
        }

        if (typeof value === "boolean") {
            // narrowing `value` to `boolean` doesn't narrow `criteriaItem` to `StandardCriteriaOfItem<boolean>` :-(
            return this.testBooleanValueCriteriaItem(value, criteriaItem as StandardCriteriaOfItem<boolean>);
        }

        if (typeof value === "string") {
            return this.testStringValueCriteriaItem(value, criteriaItem as StandardCriteriaOfItem<string>);
        }

        if (typeof value === "number") {
            return this.testNumberValueCriteriaItem(value, criteriaItem as StandardCriteriaOfItem<number>);
        }

        if (typeof value === "bigint" || value instanceof Utils.BigNumber) {
            return this.testBigNumberValueCriteriaItem(
                value,
                criteriaItem as StandardCriteriaOfItem<BigInt | Utils.BigNumber>,
            );
        }

        if (value instanceof Semver) {
            return this.testSemverValueCriteriaItem(value, criteriaItem as StandardCriteriaOfItem<Semver>);
        }

        if (typeof value === "object" && !Array.isArray(value)) {
            // doesn't narrow to `object`, nor excluding `symbol` does :-(
            return this.testObjectValueCriteriaItem(value as any, criteriaItem as StandardCriteriaOfItem<object>);
        }

        // The only two other types left are:
        // `symbol` which is obviously not supported
        // `array` which is unfortunately not supported.
        //
        // Syntax for OR (array of criteria items) creates a conflict when testing array properties.
        //
        // Consider hypothetical resource that has array property:
        // { owners: ["alice", "bob", "charlie"] }
        //
        // Criteria that is used:
        // { owners: ["alice", "charlie"] }
        //
        // If it's "alice AND charlie" then how to specify "alice OR charlie"?
        // If it's "alice OR charlie" then how to specify "alice AND charlie"?
        //
        // Peer is the only resource with array property.

        throw new UnsupportedValue(value, []);
    }

    private testBooleanValueCriteriaItem(value: boolean, criteriaItem: StandardCriteriaOfItem<boolean>): boolean {
        // In most cases criteria is cast to the same type as value during validation (by joi).
        // Wallet's attributes property is an exception. There is currently no way to know what types may be there.
        // To test properties within it string values are also checked.
        // For example boolean `true` value is checked against boolean `true` and string `"true"`.

        if (![true, false, "true", "false"].includes(criteriaItem)) {
            throw new InvalidCriteria(value, criteriaItem, []);
        }

        if (value) {
            return criteriaItem === true || criteriaItem === "true";
        } else {
            return criteriaItem === false || criteriaItem === "false";
        }
    }

    private testStringValueCriteriaItem(value: string, criteriaItem: StandardCriteriaOfItem<string>): boolean {
        if (typeof criteriaItem !== "string") {
            throw new InvalidCriteria(value, criteriaItem, []);
        }

        if (criteriaItem.indexOf("%") === -1) {
            return criteriaItem === value;
        }

        // TODO: handle escape sequences (\%, \\, etc)

        let nextIndexFrom = 0;
        for (const part of criteriaItem.split("%")) {
            const index = value.indexOf(part, nextIndexFrom);
            if (index === -1) {
                return false;
            }
            nextIndexFrom = index + part.length;
        }
        return true;
    }

    private testNumberValueCriteriaItem(value: number, criteriaItem: StandardCriteriaOfItem<number>): boolean {
        if (typeof criteriaItem === "string" || typeof criteriaItem === "number") {
            if (isNaN(Number(criteriaItem))) {
                throw new InvalidCriteria(value, criteriaItem, []);
            }

            return value === Number(criteriaItem);
        }

        if (typeof criteriaItem === "object" && criteriaItem !== null) {
            if ("from" in criteriaItem) {
                if (isNaN(Number(criteriaItem["from"]))) {
                    throw new InvalidCriteria(value, criteriaItem.from, ["from"]);
                }
            }

            if ("to" in criteriaItem) {
                if (isNaN(Number(criteriaItem["to"]))) {
                    throw new InvalidCriteria(value, criteriaItem.to, ["to"]);
                }
            }

            if ("from" in criteriaItem && "to" in criteriaItem) {
                return value >= Number(criteriaItem["from"]) && value <= Number(criteriaItem["to"]);
            }

            if ("from" in criteriaItem) {
                return value >= Number(criteriaItem["from"]);
            }

            if ("to" in criteriaItem) {
                return value <= Number(criteriaItem["to"]);
            }
        }

        throw new InvalidCriteria(value, criteriaItem, []);
    }

    private testBigNumberValueCriteriaItem(
        value: BigInt | Utils.BigNumber,
        criteriaItem: StandardCriteriaOfItem<BigInt | Utils.BigNumber>,
    ): boolean {
        // Utils.BigNumber.make doesn't perform instanceof check
        const bnValue = value instanceof Utils.BigNumber ? value : Utils.BigNumber.make(value);

        if (
            typeof criteriaItem === "number" ||
            typeof criteriaItem === "string" ||
            typeof criteriaItem === "bigint" ||
            criteriaItem instanceof Utils.BigNumber
        ) {
            try {
                return bnValue.isEqualTo(criteriaItem);
            } catch (error) {
                throw new InvalidCriteria(value, criteriaItem, []);
            }
        }

        if (typeof criteriaItem === "object" && criteriaItem !== null) {
            try {
                if ("from" in criteriaItem && "to" in criteriaItem) {
                    return bnValue.isGreaterThanEqual(criteriaItem.from) && bnValue.isLessThanEqual(criteriaItem.to);
                }

                if ("from" in criteriaItem) {
                    return bnValue.isGreaterThanEqual(criteriaItem.from);
                }

                if ("to" in criteriaItem) {
                    return bnValue.isLessThanEqual(criteriaItem.to);
                }
            } catch (error) {
                if ("from" in criteriaItem) {
                    try {
                        Utils.BigNumber.make(criteriaItem.from);
                    } catch (error) {
                        throw new InvalidCriteria(value, criteriaItem.from, ["from"]);
                    }
                }

                if ("to" in criteriaItem) {
                    try {
                        Utils.BigNumber.make(criteriaItem.to);
                    } catch (error) {
                        throw new InvalidCriteria(value, criteriaItem.to, ["to"]);
                    }
                }

                throw error;
            }
        }

        throw new InvalidCriteria(value, criteriaItem, []);
    }

    private testObjectValueCriteriaItem(value: object, criteriaItem: StandardCriteriaOfItem<object>): boolean {
        const criteriaKeys = Object.keys(criteriaItem);

        if (criteriaKeys.length === 1 && criteriaKeys[0] === "*") {
            try {
                return Object.values(value).some((v) => {
                    return this.testStandardCriterias(v, criteriaItem["*"]);
                });
            } catch (error) {
                this.rethrowError(error, "*");
            }
        } else {
            return criteriaKeys.every((key) => {
                try {
                    if (
                        key === "publicKey" &&
                        typeof value[key + "s"] === "object" &&
                        value[key + "s"] !== null &&
                        typeof criteriaItem[key] === "object" &&
                        criteriaItem[key] !== null
                    ) {
                        const publicKeys: string[] = [];
                        const keys = Object.values(value[key + "s"]);
                        for (const key of keys) {
                            if (typeof key === "string") {
                                publicKeys.push(key.toLowerCase());
                            } else {
                                publicKeys.push(...Object.keys(key as string).map((key) => key.toLowerCase()));
                            }
                        }
                        for (const publicKey of criteriaItem[key]) {
                            if (publicKeys.includes(publicKey)) {
                                return true;
                            }
                        }
                    }

                    if (
                        key === "votingFor" &&
                        typeof value[key] === "object" &&
                        value[key] !== null &&
                        typeof criteriaItem[key] === "object" &&
                        criteriaItem[key] !== null
                    ) {
                        const valueKey = Object.keys(value[key]);
                        const criteriaKey = Object.keys(criteriaItem[key][0])[0];
                        const criteriaValue = criteriaItem[key][0][criteriaKey];
                        if (criteriaValue === "*") {
                            return valueKey.includes(criteriaKey);
                        }
                    }

                    return this.testStandardCriterias(value[key], criteriaItem[key]);
                } catch (error) {
                    this.rethrowError(error, key);
                }
            });
        }
    }

    private testSemverValueCriteriaItem(value: Semver, criteriaItem: StandardCriteriaOfItem<Semver>): boolean {
        const svValue = value instanceof Semver ? value : new Semver(value);
        if (typeof criteriaItem === "string" || criteriaItem instanceof Semver) {
            try {
                return svValue.isEqualTo(criteriaItem);
            } catch (error) {
                throw new InvalidCriteria(value, criteriaItem, []);
            }
        }

        if (typeof criteriaItem === "object" && criteriaItem !== null) {
            try {
                if ("from" in criteriaItem && "to" in criteriaItem) {
                    return svValue.isGreaterThanEqual(criteriaItem.from) && svValue.isLessThanEqual(criteriaItem.to);
                }

                if ("from" in criteriaItem) {
                    return svValue.isGreaterThanEqual(criteriaItem.from);
                }

                if ("to" in criteriaItem) {
                    return svValue.isLessThanEqual(criteriaItem.to);
                }
            } catch (error) {
                if ("from" in criteriaItem) {
                    try {
                        new Semver(criteriaItem.from);
                    } catch (error) {
                        throw new InvalidCriteria(value, criteriaItem.from, ["from"]);
                    }
                }

                if ("to" in criteriaItem) {
                    try {
                        new Semver(criteriaItem.to);
                    } catch (error) {
                        throw new InvalidCriteria(value, criteriaItem.to, ["to"]);
                    }
                }

                throw error;
            }
        }

        throw new InvalidCriteria(value, criteriaItem, []);
    }

    private rethrowError(error: Error, key: string): never {
        if (error instanceof InvalidCriteria) {
            throw new InvalidCriteria(error.value, error.criteria, [key, ...error.path]);
        }

        if (error instanceof UnsupportedValue) {
            throw new UnsupportedValue(error.value, [key, ...error.path]);
        }

        if (error instanceof UnexpectedError) {
            throw new UnexpectedError(error.error, [key, ...error.path]);
        }

        throw new UnexpectedError(error, [key]);
    }
}
