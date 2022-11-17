import { Container, Contracts } from "@solar-network/kernel";

import { RoundModel } from "../models";
import { Repository } from "./repository";

@Container.injectable()
export class RoundRepository extends Repository<RoundModel> implements Contracts.Database.RoundRepository {
    public async getRound(round: number): Promise<RoundModel[]> {
        const mod = this.toModel(
            RoundModel,
            await this.createQueryBuilder()
                .select(
                    "(SELECT public_key FROM public_keys WHERE public_keys.id = public_key_id LIMIT 1)",
                    "publicKey",
                )
                .select(
                    "CAST((SELECT identity FROM identities WHERE identity_id = identities.id AND is_username = 1 LIMIT 1) AS TEXT)",
                    "username",
                )
                .select("balance")
                .select("round")
                .from("rounds")
                .where("round = :round", { round })
                .orderBy("balance", "DESC")
                .orderBy("publicKey", "ASC")
                .run(),
        );
        return mod;
    }
}
