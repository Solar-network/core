import { Contracts } from "@packages/kernel/dist";

export class TypeModel implements Contracts.Database.TypeModel {
    public id!: number;

    public type!: string;
}
