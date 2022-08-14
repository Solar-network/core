import { Contracts } from "@solar-network/kernel";
import { Column, Entity } from "typeorm";

@Entity({
    name: "missed_blocks",
})
export class MissedBlock implements Contracts.Database.MissedBlockModel {
    @Column({
        primary: true,
        type: "integer",
        nullable: false,
    })
    public timestamp!: number;

    @Column({
        type: "integer",
        nullable: false,
    })
    public height!: number;

    @Column({
        type: "varchar",
        nullable: false,
    })
    public username!: string;
}
