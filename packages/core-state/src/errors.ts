import { Utils } from "@solar-network/core-kernel";

export class BlockNotInDatabaseError extends Error {
    public constructor(height: number) {
        super(`The block from the saved state at height ${height.toLocaleString()} does not exist in the blockchain`);
    }
}

export class CorruptSavedStateError extends Error {
    public constructor(height: number) {
        super(
            `There was a data corruption error when restoring the saved state from height ${height.toLocaleString()}`,
        );
    }
}

export class IncompatibleSavedStateError extends Error {
    public constructor(height: number) {
        super(`The saved state from height ${height.toLocaleString()} is not compatible with this version of Core`);
    }
}

export class StaleSavedStateError extends Error {
    public constructor(height: number, snapshotHeight: number) {
        const blocksAgo = snapshotHeight - height;
        super(
            `The saved state from height ${height.toLocaleString()} is too old (${blocksAgo.toLocaleString()} ${Utils.pluralize(
                "block",
                blocksAgo,
            )} ago)`,
        );
    }
}
