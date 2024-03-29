import Hapi from "@hapi/hapi";
import { Crypto, Identities, Interfaces } from "@solar-network/crypto";
import { Container, Contracts, Utils } from "@solar-network/kernel";
import { Socket } from "@solar-network/nes";
import { DatabaseInterceptor } from "@solar-network/state";
import { readJsonSync } from "fs-extra";

import { constants } from "../../constants";
import { getPeerConfig } from "../utils/get-peer-config";
import { Controller } from "./controller";

interface GetPeersRequest extends Hapi.Request {
    socket: Socket;
}

export class PeerController extends Controller {
    @Container.inject(Container.Identifiers.PeerRepository)
    private readonly peerRepository!: Contracts.P2P.PeerRepository;

    @Container.inject(Container.Identifiers.DatabaseInterceptor)
    private readonly databaseInterceptor!: DatabaseInterceptor;

    @Container.inject(Container.Identifiers.BlockchainService)
    private readonly blockchain!: Contracts.Blockchain.Blockchain;

    @Container.inject(Container.Identifiers.WalletRepository)
    @Container.tagged("state", "blockchain")
    private readonly walletRepository!: Contracts.State.WalletRepository;

    private cachedHeader: Contracts.P2P.PeerPingResponse | undefined;

    public getPeers(request: GetPeersRequest, h: Hapi.ResponseToolkit): Contracts.P2P.PeerBroadcast[] {
        return this.peerRepository
            .getPeers()
            .filter((peer) => peer.ip !== request.info.remoteAddress)
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
                header: lastBlock.getHeader(false),
            },
            config: getPeerConfig(this.app),
        };

        const stateBuffer = Buffer.from(Utils.stringify(header));

        header.publicKeys = [];
        header.signatures = [];

        const delegates: (string | undefined)[] = this.walletRepository
            .allByUsername()
            .map((wallet) => wallet.getPublicKey());

        const publicKeys = Utils.getForgerDelegates();
        if (publicKeys.length > 0) {
            const { keys } = readJsonSync(`${this.app.configPath()}/delegates.json`);
            for (const key of keys) {
                const keyPair: Interfaces.IKeyPair = Identities.Keys.fromPrivateKey(key);
                if (
                    delegates.includes(keyPair.publicKey.secp256k1) &&
                    publicKeys.includes(keyPair.publicKey.secp256k1)
                ) {
                    header.publicKeys.push(keyPair.publicKey.secp256k1);
                    header.signatures.push(Crypto.Hash.signSchnorr(stateBuffer, keyPair));
                }
            }
        }

        this.cachedHeader = header;

        return header;
    }
}
