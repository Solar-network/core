import { Container, Contracts, Utils } from "@arkecosystem/core-kernel";
import { DatabaseInteraction, DatabaseInterceptor } from "@arkecosystem/core-state";
import { Crypto, Identities, Interfaces } from "@arkecosystem/crypto";
import Hapi from "@hapi/hapi";

import { constants } from "../../constants";
import { MissingCommonBlockError } from "../../errors";
import { getPeerIp } from "../../utils/get-peer-ip";
import { getPeerConfig } from "../utils/get-peer-config";
import { Controller } from "./controller";

export class PeerController extends Controller {
    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly peerRepository!: Contracts.P2P.PeerRepository;

    @Container.inject(Container.Identifiers.DatabaseInteraction)
    private readonly databaseInteraction!: DatabaseInteraction;

    @Container.inject(Container.Identifiers.DatabaseInterceptor)
    private readonly databaseInterceptor!: DatabaseInterceptor;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    private cachedHeader: Contracts.P2P.PeerPingResponse | undefined;

    public getPeers(request: Hapi.Request, h: Hapi.ResponseToolkit): Contracts.P2P.PeerBroadcast[] {
        const peerIp = getPeerIp(request.socket);

        return this.peerRepository
            .getPeers()
            .filter((peer) => peer.ip !== peerIp)
            .filter((peer) => peer.port !== -1)
            .sort((a, b) => {
                Utils.assert.defined<number>(a.latency);
                Utils.assert.defined<number>(b.latency);

                return a.latency - b.latency;
            })
            .slice(0, constants.MAX_PEERS_GETPEERS)
            .map((peer) => peer.toBroadcast());
    }

    public async getCommonBlocks(
        request: Hapi.Request,
        h: Hapi.ResponseToolkit,
    ): Promise<{
        common: Interfaces.IBlockData;
        lastBlockHeight: number;
    }> {
        const commonBlocks: Interfaces.IBlockData[] = await this.databaseInterceptor.getCommonBlocks(
            (request.payload as any).ids,
        );

        if (!commonBlocks.length) {
            throw new MissingCommonBlockError();
        }

        return {
            common: commonBlocks.sort((a, b) => a.height - b.height)[commonBlocks.length - 1],
            lastBlockHeight: this.blockchain.getLastBlock().data.height,
        };
    }

    public async getStatus(request: Hapi.Request, h: Hapi.ResponseToolkit): Promise<Contracts.P2P.PeerPingResponse> {
        const lastBlock: Interfaces.IBlock = this.blockchain.getLastBlock();

        const blockTimeLookup = await Utils.forgingInfoCalculator.getBlockTimeLookup(this.app, lastBlock.data.height);
        const slotInfo = Crypto.Slots.getSlotInfo(blockTimeLookup);

        if (
            this.cachedHeader &&
            this.cachedHeader.state.header.id === lastBlock.data.id &&
            this.cachedHeader.state.forgingAllowed === slotInfo.forgingStatus &&
            this.cachedHeader.state.currentSlot === slotInfo.slotNumber
        ) {
            return this.cachedHeader;
        }

        const header: Contracts.P2P.PeerPingResponse = {
            state: {
                height: lastBlock.data.height,
                forgingAllowed: slotInfo.forgingStatus,
                currentSlot: slotInfo.slotNumber,
                header: lastBlock.getHeader(),
            },
            config: getPeerConfig(this.app),
        };

        const stateBuffer = Buffer.from(Utils.stringify(header));

        header.publicKeys = [];
        header.signatures = [];

        const height = lastBlock.data.height + 1;
        const roundInfo = Utils.roundCalculator.calculateRound(height);

        const delegates = (await this.databaseInteraction.getActiveDelegates(roundInfo)).map(
            (wallet: Contracts.State.Wallet) => wallet.getPublicKey(),
        );

        if (Utils.isForgerRunning()) {
            for (const secret of this.app.config("delegates.secrets")) {
                const keys: Interfaces.IKeyPair = Identities.Keys.fromPassphrase(secret);
                if (delegates.includes(keys.publicKey)) {
                    header.publicKeys.push(keys.publicKey);
                    header.signatures.push(Crypto.Hash.signSchnorr(stateBuffer, keys));
                }
            }
        }

        this.cachedHeader = header;

        return header;
    }
}
