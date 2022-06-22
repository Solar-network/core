import { Utils } from "@solar-network/crypto";
import { Contracts } from "@solar-network/kernel";

import { peer } from "./proto/protos";

export const getPeers = {
    request: {
        serialise: (obj: peer.GetPeersRequest): Buffer => Buffer.from(peer.GetPeersRequest.encode(obj).finish()),
        deserialise: (payload: Buffer): {} => peer.GetPeersRequest.decode(payload),
    },
    response: {
        serialise: (peers: Contracts.P2P.PeerBroadcast[]): Buffer => {
            return Buffer.from(peer.GetPeersResponse.encode({ peers }).finish());
        },
        deserialise: (payload: Buffer): Contracts.P2P.PeerBroadcast[] => {
            return peer.GetPeersResponse.decode(payload).peers as Contracts.P2P.PeerBroadcast[];
        },
    },
};

export const getCommonBlocks = {
    request: {
        serialise: (obj: peer.IGetCommonBlocksRequest): Buffer => {
            return Buffer.from(peer.GetCommonBlocksRequest.encode(obj).finish());
        },
        deserialise: (payload: Buffer): peer.IGetCommonBlocksRequest => {
            return peer.GetCommonBlocksRequest.decode(payload);
        },
    },
    response: {
        serialise: (obj: peer.IGetCommonBlocksResponse): Buffer => {
            return Buffer.from(peer.GetCommonBlocksResponse.encode(obj).finish());
        },
        deserialise: (payload: Buffer): peer.IGetCommonBlocksResponse => {
            return peer.GetCommonBlocksResponse.decode(payload);
        },
    },
};

export const getStatus = {
    request: {
        serialise: (obj: peer.GetStatusRequest): Buffer => Buffer.from(peer.GetStatusRequest.encode(obj).finish()),
        deserialise: (payload: Buffer): {} => peer.GetStatusRequest.decode(payload),
    },
    response: {
        serialise: (obj: Contracts.P2P.PeerPingResponse): Buffer => {
            obj.state.header.totalAmount = obj.state.header.totalAmount.toString();
            obj.state.header.totalFee = obj.state.header.totalFee.toString();
            obj.state.header.reward = obj.state.header.reward.toString();
            return Buffer.from(peer.GetStatusResponse.encode(obj).finish());
        },
        deserialise: (payload: Buffer): Contracts.P2P.PeerPingResponse => {
            const decoded = peer.GetStatusResponse.decode(payload);
            const totalAmount = new Utils.BigNumber(decoded.state!.header!.totalAmount!);
            const totalFee = new Utils.BigNumber(decoded.state!.header!.totalFee!);
            const reward = new Utils.BigNumber(decoded.state!.header!.reward!);

            return {
                ...decoded,
                state: {
                    ...decoded.state,
                    header: {
                        ...decoded.state?.header,
                        totalAmount,
                        totalFee,
                        reward,
                    },
                },
                publicKeys: decoded.publicKeys,
                signatures: decoded.signatures,
            } as Contracts.P2P.PeerPingResponse;
        },
    },
};
