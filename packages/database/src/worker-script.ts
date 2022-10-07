import { Utils as AppUtils } from "@solar-network/kernel";

import { WorkerScriptHandler } from "./worker-script-handler";

const workerHandler = new AppUtils.WorkerHandler(new WorkerScriptHandler());
workerHandler.handleAction("checkpoint");
workerHandler.handleAction("start");
workerHandler.handleRequest("pragma");
workerHandler.handleRequest("query");
workerHandler.handleRequest("transaction");
