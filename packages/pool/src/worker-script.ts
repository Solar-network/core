import { Utils as AppUtils } from "@solar-network/kernel";

import { WorkerScriptHandler } from "./worker-script-handler";

const workerHandler = new AppUtils.WorkerHandler(new WorkerScriptHandler());
workerHandler.handleAction("setConfig");
workerHandler.handleAction("setHeight");
workerHandler.handleRequest("getTransaction");
