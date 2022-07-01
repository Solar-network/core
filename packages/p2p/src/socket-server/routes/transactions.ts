import { constants } from "../../constants";
import { getUnconfirmedTransactions, postTransactions } from "../codecs/transactions";
import { TransactionsController } from "../controllers/transactions";
import { transactionsSchemas } from "../schemas/transactions";
import { Route, RouteConfig } from "./route";

export class TransactionsRoute extends Route {
    public getRoutesConfigByPath(): { [path: string]: RouteConfig } {
        const controller = this.getController();
        return {
            "/p2p/transactions/getUnconfirmedTransactions": {
                id: "p2p.transactions.getUnconfirmedTransactions",
                handler: controller.getUnconfirmedTransactions,
                codec: getUnconfirmedTransactions,
                maxBytes: 1024,
            },
            "/p2p/transactions/postTransactions": {
                id: "p2p.transactions.postTransactions",
                handler: controller.postTransactions,
                validation: transactionsSchemas.createPostTransactionsSchema(this.app),
                codec: postTransactions,
                maxBytes: constants.DEFAULT_MAX_PAYLOAD,
            },
        };
    }

    protected getController(): TransactionsController {
        return this.app.resolve(TransactionsController);
    }
}
