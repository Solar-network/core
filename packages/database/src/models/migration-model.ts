import { Contracts } from "@solar-network/kernel";

export class MigrationModel implements Contracts.Database.MigrationModel {
    public id!: number;

    public name!: string;

    public timestamp!: number;
}
