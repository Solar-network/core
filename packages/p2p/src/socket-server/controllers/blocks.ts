import Hapi from "@hapi/hapi";
import { Blocks, Interfaces, Managers, Utils } from "@solar-network/crypto";
import { DatabaseService } from "@solar-network/database";
import { Container, Contracts, Providers, Utils as AppUtils } from "@solar-network/kernel";

import { constants } from "../../constants";
import { TooManyTransactionsError } from "../errors";
import { mapAddr } from "../utils/map-addr";
import { Controller } from "./controller";

export interface BlockRequest extends Hapi.Request {
    payload: {
        block: Buffer;
    };
}

export class BlocksController extends Controller {
    @Container.inject(Container.Identifiers.PluginConfiguration)
    @Container.tagged("plugin", "@solar-network/p2p")
    private readonly configuration!: Providers.PluginConfiguration;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.DatabaseService)
    private readonly database!: DatabaseService;

    @Container.inject(Container.Identifiers.RoundState)
    private readonly roundState!: Contracts.State.RoundState;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    public async postBlock(
        request: BlockRequest,
        h: Hapi.ResponseToolkit,
    ): Promise<{ status: boolean; height: number }> {
        const blockBuffer: Buffer = request.payload.block;

        const deserialisedHeader = Blocks.Deserialiser.deserialise(blockBuffer, true);

        if (
            deserialisedHeader.data.numberOfTransactions > Managers.configManager.getMilestone().block.maxTransactions
        ) {
            throw new TooManyTransactionsError(deserialisedHeader.data);
        }

        const fromOurNode: boolean = AppUtils.isWhitelisted(
            this.configuration.getOptional<string[]>("remoteAccess", []),
            request.info.remoteAddress,
        );

        if (!fromOurNode) {
            if (this.blockchain.pingBlock(deserialisedHeader.data)) {
                return { status: true, height: this.blockchain.getLastHeight() };
            }

            const lastDownloadedBlock: Interfaces.IBlockData = this.blockchain.getLastDownloadedBlock();

            const blockTimeLookup = await AppUtils.blockProductionInfoCalculator.getBlockTimeLookup(
                this.app,
                deserialisedHeader.data.height,
            );

            if (!AppUtils.isBlockChained(lastDownloadedBlock, deserialisedHeader.data, blockTimeLookup)) {
                return { status: false, height: this.blockchain.getLastHeight() };
            }
        }

        const deserialised: {
            data: Interfaces.IBlockData;
            transactions: Interfaces.ITransaction[];
        } = Blocks.Deserialiser.deserialise(blockBuffer);

        const block: Interfaces.IBlockData = {
            ...deserialised.data,
            transactions: deserialised.transactions.map((tx) => tx.data),
        };

        this.blockchain.setBlockUsername(block);
        const { height, numberOfTransactions, id, reward, username } = block;

        if (!username || !this.walletRepository.hasByUsername(username)) {
            return { status: false, height: this.blockchain.getLastHeight() };
        }

        const generatorWallet: Contracts.State.Wallet = this.walletRepository.findByUsername(username);

        if (!generatorWallet.hasAttribute("blockProducer.rank")) {
            return { status: false, height: this.blockchain.getLastHeight() };
        }

        const rank = generatorWallet.getAttribute("blockProducer.rank");
        const generator: string = `${username} (#${rank})`;

        this.logger.info(
            `Received new block by ${generator} at height ${height.toLocaleString()} with ${Utils.formatSatoshi(
                reward,
            )} reward`,
            "📥",
        );

        const { dynamicReward } = Managers.configManager.getMilestone();

        if (dynamicReward && dynamicReward.enabled && reward.isEqualTo(dynamicReward.secondaryReward)) {
            const { alreadyProducedBlock } = await this.roundState.getRewardForBlockInRound(height, generatorWallet);
            if (alreadyProducedBlock && !reward.isEqualTo(dynamicReward.ranks[rank])) {
                this.logger.info(
                    `The reward was reduced because ${username} already produced a block in this round`,
                    "🪙",
                );
            }
        }

        this.logger.trace(`The id of the new block is ${id}`, "🏷️");

        const ip: string = mapAddr(request.info.remoteAddress);

        this.logger.debug(
            `It contains ${AppUtils.pluralise("transaction", numberOfTransactions, true)} and was received from ${ip}`,
            numberOfTransactions === 0 ? "🪹" : "🪺",
        );

        this.blockchain.handleIncomingBlock(block, fromOurNode, ip);

        return { status: true, height: this.blockchain.getLastHeight() };
    }

    public async getBlocks(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<Interfaces.IBlockData[] | Contracts.Shared.DownloadBlock[]> {
        const reqBlockHeight: number = +(request.payload as any).lastBlockHeight + 1;
        const reqBlockLimit: number = +(request.payload as any).blockLimit || 400;
        const reqHeadersOnly: boolean = !!(request.payload as any).headersOnly;

        const lastHeight: number = this.blockchain.getLastHeight();
        if (reqBlockHeight > lastHeight) {
            return [];
        }

        const blocks: Contracts.Shared.DownloadBlock[] = await this.database.getBlocksForDownload(
            reqBlockHeight,
            reqBlockLimit,
            reqHeadersOnly,
        );

        // Only return the blocks fetched while we are below the p2p maxPayload limit
        const blocksToReturn: Contracts.Shared.DownloadBlock[] = [];
        const maxPayloadWithMargin = constants.DEFAULT_MAX_PAYLOAD - 100 * 1024; // 100KB margin because we're dealing with estimates
        for (let i = 0, sizeEstimate = 0; sizeEstimate < maxPayloadWithMargin && i < blocks.length; i++) {
            blocksToReturn.push(blocks[i]);
            sizeEstimate += blocks[i].transactions?.reduce((acc, curr) => acc + curr.length, 0) ?? 0;
            // We estimate the size of each block -- as it will be sent through p2p -- with the length of the
            // associated transactions. When blocks are big, size of the block header is negligible compared to its
            // transactions. And here we just want a broad limit to stop when getting close to p2p max payload.
        }

        this.logger.info(
            `${mapAddr(request.info.remoteAddress)} has downloaded ${AppUtils.pluralise(
                "block",
                blocksToReturn.length,
                true,
            )} from height ${reqBlockHeight.toLocaleString()}`,
            "📤",
        );

        return blocksToReturn;
    }
}
