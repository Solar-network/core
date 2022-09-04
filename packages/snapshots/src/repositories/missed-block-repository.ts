import { Models } from "@solar-network/database";
import { Readable } from "stream";
import { EntityRepository } from "typeorm";

import { AbstractRepository } from "./abstract-repository";

@EntityRepository(Models.MissedBlock)
export class MissedBlockRepository extends AbstractRepository<Models.MissedBlock> {
    public async getReadStream(start: number, end: number): Promise<Readable> {
        return this.createQueryBuilder()
            .where("height >= :start AND height <= :end", { start, end })
            .orderBy("height", "ASC")
            .stream();
    }

    public async countInRange(start: number, end: number): Promise<number> {
        return this.fastCount({ where: "height >= :start AND height <= :end", parameters: { start, end } });
    }

    public async findLast(): Promise<Models.MissedBlock | undefined> {
        const topBlocks = await this.find({
            take: 1,
            order: {
                height: "DESC",
            },
        });

        return topBlocks[0];
    }

    public async findFirst(): Promise<Models.MissedBlock | undefined> {
        const topBlocks = await this.find({
            take: 1,
            order: {
                height: "ASC",
            },
        });

        return topBlocks[0];
    }

    public async findByHeight(height: number): Promise<Models.MissedBlock | undefined> {
        return this.findOne({
            height: height,
        });
    }
}
