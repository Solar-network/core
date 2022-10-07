import Boom from "@hapi/boom";
import Hapi from "@hapi/hapi";
import { Container, Contracts } from "@solar-network/kernel";

import { RoundResource } from "../resources";
import { Controller } from "./controller";

export class RoundsController extends Controller {
    @Container.inject(Container.Identifiers.DatabaseRoundRepository)
    private readonly roundRepository!: Contracts.Database.RoundRepository;

    public async delegates(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<object | Boom.Boom> {
        const delegates = await this.roundRepository.getRound(+request.params.id);

        if (!delegates || !delegates.length) {
            return Boom.notFound("Round not found");
        }

        return this.respondWithCollection(delegates, RoundResource);
    }
}
