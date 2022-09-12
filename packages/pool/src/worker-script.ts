import { Utils as AppUtils } from "@solar-network/kernel";

import { WorkerScriptHandler } from "./worker-script-handler";

const ipcHandler = new AppUtils.IpcHandler(new WorkerScriptHandler());
ipcHandler.handleAction("setConfig");
ipcHandler.handleAction("setHeight");
ipcHandler.handleRequest("getTransaction");
