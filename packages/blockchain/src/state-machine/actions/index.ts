import { BlockchainReady } from "./blockchain-ready";
import { CheckLastBlockSynced } from "./check-last-block-synced";
import { CheckLastDownloadedBlockSynced } from "./check-last-downloaded-block-synced";
import { CheckLater } from "./check-later";
import { DownloadBlocks } from "./download-blocks";
import { DownloadFinished } from "./download-finished";
import { DownloadPaused } from "./download-paused";
import { ExitApp } from "./exit-app";
import { Initialise } from "./initialise";
import { RollbackDatabase } from "./rollback-database";
import { StartForkRecovery } from "./start-fork-recovery";
import { Stopped } from "./stopped";
import { SyncingComplete } from "./syncing-complete";

export const actions = {
    blockchainReady: BlockchainReady,
    checkLastBlockSynced: CheckLastBlockSynced,
    checkLastDownloadedBlockSynced: CheckLastDownloadedBlockSynced,
    checkLater: CheckLater,
    downloadBlocks: DownloadBlocks,
    downloadFinished: DownloadFinished,
    downloadPaused: DownloadPaused,
    exitApp: ExitApp,
    initialise: Initialise,
    rollbackDatabase: RollbackDatabase,
    startForkRecovery: StartForkRecovery,
    stopped: Stopped,
    syncingComplete: SyncingComplete,
};
