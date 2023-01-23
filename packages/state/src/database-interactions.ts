import { Blocks, Interfaces, Managers, Utils } from "@solar-network/crypto";
import { DatabaseService } from "@solar-network/database";
import { Container, Contracts, Enums, Utils as AppUtils } from "@solar-network/kernel";
import { Handlers } from "@solar-network/transactions";

import { RoundState } from "./round-state";

@Container.injectable()
export class DatabaseInteraction {
    @Container.inject(Container.Identifiers.Application)
    private readonly app!: Contracts.Kernel.Application;

    @Container.inject(Container.Identifiers.DatabaseService)
    private readonly databaseService!: DatabaseService;

    @Container.inject(Container.Identifiers.BlockState)
    @Container.tagged("state", "blockchain")
    private readonly blockState!: Contracts.State.BlockState;

    @Container.inject(Container.Identifiers.StateStore)
    private readonly stateStore!: Contracts.State.StateStore;

    @Container.inject(Container.Identifiers.StateTransactionStore)
    private readonly stateTransactionStore!: Contracts.State.TransactionStore;

    @Container.inject(Container.Identifiers.StateBlockStore)
    private readonly stateBlockStore!: Contracts.State.BlockStore;

    @Container.inject(Container.Identifiers.TransactionHandlerRegistry)
    @Container.tagged("state", "blockchain")
    private readonly handlerRegistry!: Handlers.Registry;

    @Container.inject(Container.Identifiers.EventDispatcherService)
    private readonly events!: Contracts.Kernel.EventDispatcher;

    @Container.inject(Container.Identifiers.LogService)
    private readonly logger!: Contracts.Kernel.Logger;

    @Container.inject(Container.Identifiers.RoundState)
    private readonly roundState!: RoundState;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private walletRepository!: Contracts.State.WalletRepository;

    private blockchain!: Contracts.Blockchain.Blockchain;

    private historicalVoters: { percent: any; username: any; voteBalance: any; voters: any }[] | undefined;

    public async initialise(): Promise<void> {
        try {
            this.events.dispatch(Enums.StateEvent.Starting);

            const genesisBlockJson = Managers.configManager.get("genesisBlock");
            const genesisBlock = Blocks.BlockFactory.fromJson(genesisBlockJson, { isGenesisBlock: true });

            this.stateStore.setGenesisBlock(genesisBlock!);

            this.blockchain = this.app.get<Contracts.Blockchain.Blockchain>(Container.Identifiers.BlockchainService);

            await this.initialiseLastBlock();
        } catch (error) {
            this.logger.critical(error.stack);
            this.app.terminate("Failed to initialise database service", error);
        }
    }

    public async applyBlock(
        block: Interfaces.IBlock,
        transactionProcessing: {
            index: number | undefined;
        },
    ): Promise<void> {
        let supply: string;

        if (!this.historicalVoters) {
            supply = AppUtils.supplyCalculator.calculate(this.walletRepository.allByAddress());
            this.historicalVoters = this.getDelegateVoters(supply);
        }

        await this.roundState.detectMissedBlocks(block);

        await this.blockState.applyBlock(block, transactionProcessing);
        await this.roundState.applyBlock(block);

        for (const transaction of block.transactions) {
            await this.emitTransactionEvents(transaction);
        }

        if (this.blockchain.getQueue().size() === 0) {
            supply = AppUtils.supplyCalculator.calculate(this.walletRepository.allByAddress());
            const updatedDelegates = this.getDelegateVoters(supply).filter(
                ({ percent, username, voteBalance, voters }) =>
                    !this.historicalVoters!.some(
                        ({
                            percent: oldPercent,
                            username: oldUsername,
                            voteBalance: oldVoteBalance,
                            voters: oldVoters,
                        }) =>
                            percent === oldPercent &&
                            username === oldUsername &&
                            voteBalance === oldVoteBalance &&
                            voters === oldVoters,
                    ),
            );

            for (const { percent, username, voteBalance, voters } of updatedDelegates) {
                this.events.dispatch(Enums.DelegateEvent.VoteDataChanged, {
                    percent,
                    username,
                    voteBalance,
                    voters,
                });
            }

            this.historicalVoters = undefined;
        }

        this.events.dispatch(Enums.BlockEvent.Applied, block.getHeader());
    }

    public async revertBlock(block: Interfaces.IBlock): Promise<void> {
        await this.roundState.revertBlock(block);
        await this.blockState.revertBlock(block);

        for (let i = block.transactions.length - 1; i >= 0; i--) {
            this.events.dispatch(Enums.TransactionEvent.Reverted, block.transactions[i].data);
        }

        this.events.dispatch(Enums.BlockEvent.Reverted, block.getHeader());
    }

    public async restoreCurrentRound(): Promise<void> {
        await this.roundState.restore();
    }

    private getDelegateVoters(supply: string): {
        percent: number;
        username: string;
        voteBalance: Utils.BigNumber;
        voters: number;
    }[] {
        return this.walletRepository
            .allByUsername()
            .filter((wallet: Contracts.State.Wallet) => wallet.hasAttribute("delegate"))
            .map((wallet: Contracts.State.Wallet) => {
                const delegate = wallet.getAttribute("delegate");
                return {
                    percent: AppUtils.delegateCalculator.calculateVotePercent(wallet, supply),
                    username: delegate.username,
                    voteBalance: delegate.voteBalance,
                    voters: delegate.voters,
                };
            });
    }

    private async initialiseLastBlock(): Promise<void> {
        // ? attempt to remove potentially corrupt blocks from database

        let lastBlock: Interfaces.IBlock | undefined;
        let tries = 5; // ! actually 6, but only 5 will be removed

        // Ensure the config manager is initialised, before attempting to call `fromData`
        // which otherwise uses potentially wrong milestones.
        let lastHeight: number = 1;
        const latest: Interfaces.IBlockData | undefined = await this.databaseService.findLatestBlock();
        if (latest) {
            lastHeight = latest.height;
        }

        Managers.configManager.setHeight(lastHeight);

        const getLastBlock = async (): Promise<Interfaces.IBlock | undefined> => {
            try {
                return await this.databaseService.getLastBlock();
            } catch (error) {
                this.logger.error(error.message);

                if (tries > 0) {
                    const block: Interfaces.IBlockData = (await this.databaseService.findLatestBlock())!;
                    await this.databaseService.delete([block]);
                    tries--;
                } else {
                    this.app.terminate("Unable to deserialise last block from database", error);
                    throw new Error("Terminated (unreachable)");
                }

                return getLastBlock();
            }
        };

        lastBlock = await getLastBlock();

        if (!lastBlock) {
            this.logger.warning("No block found in database", "😯");
            lastBlock = await this.createGenesisBlock();
        }

        this.configureState(lastBlock);
    }

    private async createGenesisBlock(): Promise<Interfaces.IBlock> {
        const genesisBlock = this.stateStore.getGenesisBlock();
        await this.databaseService.save([genesisBlock]);
        return genesisBlock;
    }

    private configureState(lastBlock: Interfaces.IBlock): void {
        this.stateStore.setLastBlock(lastBlock);
        const { blockTime, block } = Managers.configManager.getMilestone();
        const blocksPerDay: number = Math.ceil(86400 / blockTime);
        this.stateBlockStore.resize(blocksPerDay);
        this.stateTransactionStore.resize(blocksPerDay * block.maxTransactions);
    }

    private async emitTransactionEvents(transaction: Interfaces.ITransaction): Promise<void> {
        this.events.dispatch(Enums.TransactionEvent.Applied, transaction.data);
        const handler = await this.handlerRegistry.getActivatedHandlerForTransaction(transaction);
        handler.emitEvents(transaction);
    }
}
