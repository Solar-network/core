/**
 * @export
 * @enum {number}
 */
export enum KernelEvent {
    Booted = "kernel.booted",
    Booting = "kernel.booting",
    Bootstrapped = "kernel.bootstrapper.bootstrapped",
    Bootstrapping = "kernel.bootstrapper.bootstrapping",
    ServiceProviderBooted = "kernel.serviceProvider.booted",
    ServiceProviderDisposed = "kernel.serviceProvider.disposed",
    ServiceProviderRegistered = "kernel.serviceProvider.registered",
}

/**
 * @export
 * @enum {number}
 */
export enum CacheEvent {
    Flushed = "cache.flushed",
    Forgotten = "cache.forgotten",
    Hit = "cache.hit",
    Missed = "cache.missed",
    Written = "cache.written",
}

/**
 * @export
 * @enum {number}
 */
export enum CryptoEvent {
    MilestoneChanged = "crypto.milestone.changed",
}

/**
 * @export
 * @enum {number}
 */
export enum BlockchainEvent {
    Synced = "blockchain.synced",
}

/**
 * @export
 * @enum {number}
 */
export enum BlockEvent {
    Applied = "block.applied",
    Disregarded = "block.disregarded",
    Produced = "block.produced",
    Received = "block.received",
    Reverted = "block.reverted",
}

/**
 * @export
 * @enum {number}
 */
export enum BlockProducerEvent {
    DataChanged = "blockProducer.dataChanged",
    Failed = "blockProducer.failed",
    ReliabilityChanged = "blockProducer.reliabilityChanged",
    Registered = "blockProducer.registered",
    Resigned = "blockProducer.resigned",
}

/**
 * @export
 * @enum {number}
 */
export enum UsernameEvent {
    Registered = "username.registered",
}

export enum VoteEvent {
    Vote = "wallet.vote",
}

/**
 * @export
 * @enum {number}
 */
export enum PeerEvent {
    Added = "peer.added",
    Disconnect = "peer.disconnect",
    Disconnected = "peer.disconnected",
    Disconnecting = "peer.disconnecting",
    Removed = "peer.removed",
}

/**
 * @export
 * @enum {number}
 */
export enum RoundEvent {
    Applied = "round.applied",
    Created = "round.created",
    Failed = "round.failed",
}

/**
 * @export
 * @enum {number}
 */
export enum StateEvent {
    BuilderFinished = "state.builder.finished",
    Started = "state.started",
    Starting = "state.starting",
}

/**
 * @export
 * @enum {number}
 */
export enum TransactionEvent {
    AddedToPool = "transaction.pool.added",
    Applied = "transaction.applied",
    Expired = "transaction.expired",
    IncludedInBlock = "transaction.included",
    RejectedByPool = "transaction.pool.rejected",
    RemovedFromPool = "transaction.pool.removed",
    Reverted = "transaction.reverted",
}

/**
 * @export
 * @enum {number}
 */
export enum ScheduleEvent {
    BlockJobFinished = "schedule.blockJob.finished",
    CronJobFinished = "schedule.cronJob.finished",
}

/**
 * @export
 * @enum {number}
 */
export enum QueueEvent {
    Finished = "queue.finished",
    Failed = "queue.failed",
}
