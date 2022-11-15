export const Identifiers = {
    // Config
    ConfigFlags: Symbol.for("Config<Flags>"),
    ConfigPlugins: Symbol.for("Config<Plugins>"),
    // Application
    Application: Symbol.for("Application<Instance>"),
    ApplicationDirPrefix: Symbol.for("Application<DirPrefix>"),
    ApplicationEnvironment: Symbol.for("Application<Environment>"),
    ApplicationNamespace: Symbol.for("Application<Namespace>"),
    ApplicationNetwork: Symbol.for("Application<Network>"),
    ApplicationToken: Symbol.for("Application<Token>"),
    ApplicationVersion: Symbol.for("Application<Version>"),
    // Plugins
    PluginConfiguration: Symbol.for("PluginConfiguration"),
    PluginDiscoverer: Symbol.for("PluginDiscoverer"),
    // Crypto
    Crypto: Symbol.for("Crypto<NetworkConfig>"),
    // Managers
    CacheManager: Symbol.for("Manager<Cache>"),
    ConfigManager: Symbol.for("Manager<Config>"),
    DatabaseManager: Symbol.for("Manager<Database>"),
    EventDispatcherManager: Symbol.for("Manager<EventDispatcher>"),
    FilesystemManager: Symbol.for("Manager<Filesystem>"),
    LogManager: Symbol.for("Manager<Log>"),
    QueueManager: Symbol.for("Manager<Queue>"),
    ProcessActionsManager: Symbol.for("Manager<ProcessAction>"),
    ValidationManager: Symbol.for("Manager<Validation>"),
    // Services
    BlockchainService: Symbol.for("Service<Blockchain>"),
    CacheService: Symbol.for("Service<Cache>"),
    ConfigService: Symbol.for("Service<Config>"),
    DatabaseService: Symbol.for("Service<Database>"),
    EventDispatcherService: Symbol.for("Service<EventDispatcher>"),
    FilesystemService: Symbol.for("Service<Filesystem>"),
    ForgerService: Symbol.for("Service<Forger>"),
    LogService: Symbol.for("Service<Log>"),
    MixinService: Symbol.for("Service<Mixin>"),
    PipelineService: Symbol.for("Service<Pipeline>"),
    QueueService: Symbol.for("Service<Queue>"),
    ScheduleService: Symbol.for("Service<Schedule>"),
    SnapshotService: Symbol.for("Service<Snapshot>"),
    StandardCriteriaService: Symbol.for("Service<StandardCriteriaService>"),
    PaginationService: Symbol.for("Service<PaginationService>"),
    TriggerService: Symbol.for("Service<Actions>"),
    ProcessActionsService: Symbol.for("Service<ProcessActions>"),
    ValidationService: Symbol.for("Service<Validation>"),
    BlockHistoryService: Symbol.for("Service<BlockHistory>"),
    MissedBlockHistoryService: Symbol.for("Service<MissedBlockHistory>"),
    TransactionHistoryService: Symbol.for("Service<TransactionHistory>"),

    // Factories
    CacheFactory: Symbol.for("Factory<Cache>"),
    PeerFactory: Symbol.for("Factory<Peer>"),
    PipelineFactory: Symbol.for("Factory<Pipeline>"),
    QueueFactory: Symbol.for("Factory<Queue>"),

    // Database
    DatabaseLogger: Symbol.for("Database<Logger>"),
    DatabaseConnection: Symbol.for("Database<Connection>"),
    DatabaseRoundRepository: Symbol.for("Database<RoundRepository>"),
    DatabaseBlockRepository: Symbol.for("Database<BlockRepository>"),
    DatabaseBlockFilter: Symbol.for("Database<BlockFilter>"),
    DatabaseMissedBlockFilter: Symbol.for("Database<MissedBlockFilter>"),
    DatabaseMissedBlockRepository: Symbol.for("Database<MissedBlockRepository>"),
    DatabaseTransactionRepository: Symbol.for("Database<TransactionRepository>"),
    DatabaseTransactionFilter: Symbol.for("Database<TransactionFilter>"),
    DatabaseModelConverter: Symbol.for("Database<ModelConverter>"),
    DatabaseInteraction: Symbol.for("Database<DatabaseInteraction>"),
    DatabaseWalletsTableService: Symbol.for("Database<WalletsTableService>"),

    // Kernel
    ConfigRepository: Symbol.for("Repository<Config>"),
    ServiceProviderRepository: Symbol.for("Repository<ServiceProvider>"),
    // Blockchain
    StateMachine: Symbol.for("Blockchain<StateMachine>"),
    BlockProcessor: Symbol.for("Block<Processor>"),
    // State - @todo: better names that won't clash
    BlockState: Symbol.for("State<Block>"),
    RoundState: Symbol.for("State<Round>"),
    StateBlockStore: Symbol.for("State<BlockStore>"),
    StateStore: Symbol.for("State<StateStore>"),
    StateBuilder: Symbol.for("State<StateBuilder>"),
    StateLoader: Symbol.for("State<StateLoader>"),
    StateSaver: Symbol.for("State<StateSaver>"),
    StateTransactionStore: Symbol.for("State<TransactionStore>"),
    StateWalletSyncService: Symbol.for("State<WalletSyncService>"),
    WalletFactory: Symbol.for("State<WalletFactory>"),
    WalletRepository: Symbol.for("Repository<Wallet>"),
    WalletRepositoryIndexerIndex: Symbol.for("IndexerIndex<Repository<Wallet>>"),
    TransactionValidator: Symbol.for("State<TransactionValidator>"),
    TransactionValidatorFactory: Symbol.for("State<TransactionValidatorFactory>"),
    DatabaseInterceptor: Symbol.for("State<DatabaseInterceptor>"),

    // Derived states
    DposState: Symbol.for("State<DposState>"),
    DposPreviousRoundStateProvider: Symbol("Provider<DposPreviousRoundState>"),

    // P2P - @todo: better names that won't clash
    PeerCommunicator: Symbol.for("Peer<Communicator>"),
    PeerConnector: Symbol.for("Peer<Connector>"),
    PeerChunkCache: Symbol.for("Peer<ChunkCache>"),
    PeerNetworkMonitor: Symbol.for("Peer<NetworkMonitor>"),
    PeerProcessor: Symbol.for("Peer<Processor>"),
    PeerRepository: Symbol.for("Peer<Repository>"),
    PeerTransactionBroadcaster: Symbol.for("Peer<TransactionBroadcaster>"),
    PeerEventListener: Symbol.for("Peer<EventListener>"),
    P2PServer: Symbol.for("Server<P2P>"),

    // Pool
    PoolService: Symbol.for("Pool<Service>"),
    PoolCleaner: Symbol.for("Pool<Cleaner>"),
    PoolMempool: Symbol.for("Pool<Mempool>"),
    PoolStorage: Symbol.for("Pool<Storage>"),
    PoolCollator: Symbol.for("Pool<Collator>"),
    PoolQuery: Symbol.for("Pool<Query>"),
    PoolDynamicFeeMatcher: Symbol.for("Pool<DynamicFeeMatcher>"),
    PoolProcessorExtension: Symbol.for("Pool<ProcessorExtension>"),
    PoolProcessor: Symbol.for("Pool<Processor>"),
    PoolProcessorFactory: Symbol.for("Pool<ProcessorFactory>"),
    PoolSenderMempool: Symbol.for("Pool<SenderMempool>"),
    PoolSenderMempoolFactory: Symbol.for("Pool<SenderMempoolFactory>"),
    PoolSenderState: Symbol.for("Pool<SenderState>"),
    PoolExpirationService: Symbol.for("Pool<ExpirationService>"),
    PoolWorkerPool: Symbol.for("Pool<WorkerPool>"),
    PoolWorker: Symbol.for("Pool<Worker>"),
    PoolWorkerFactory: Symbol.for("Pool<WorkerFactory>"),
    PoolWorkerThreadFactory: Symbol.for("Pool<WorkerThreadFactory>"),

    // Transactions - @todo: better names that won't clash
    WalletAttributes: Symbol.for("Wallet<Attributes>"),
    // TransactionHandler
    TransactionHandler: Symbol.for("TransactionHandler"),
    TransactionHandlerConstructors: Symbol.for("TransactionHandlerConstructors"),
    // Registries
    TransactionHandlerRegistry: Symbol.for("Registry<TransactionHandler>"),
    TransactionHandlerProvider: Symbol.for("Provider<TransactionHandler>"),

    // Watcher
    WatcherEventListener: Symbol.for("Watcher<EventListener>"),
    WatcherDatabaseService: Symbol.for("Watcher<DatabaseService>"),
};
