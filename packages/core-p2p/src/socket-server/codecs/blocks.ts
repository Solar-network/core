import { Contracts } from "@solar-network/core-kernel";
import { Interfaces, Utils } from "@solar-network/crypto";

import { blocks } from "./proto/protos";

const hardLimitNumberOfBlocks = 400;
const hardLimitNumberOfTransactions = 500;

export const getBlocks = {
    request: {
        serialise: (obj: blocks.IGetBlocksRequest): Buffer => Buffer.from(blocks.GetBlocksRequest.encode(obj).finish()),
        deserialise: (payload: Buffer): blocks.IGetBlocksRequest => blocks.GetBlocksRequest.decode(payload),
    },
    response: {
        serialise: (obj: blocks.IGetBlocksResponse): Buffer => {
            const blockBuffers: Buffer[] = [];

            for (const block of obj as Interfaces.IBlockData[]) {
                const txBuffers: Buffer[] = [];

                if (block.transactions) {
                    for (const transaction of block.transactions) {
                        const txBuffer = Buffer.from(transaction as unknown as string, "hex");
                        const txLengthBuffer = Buffer.alloc(4);
                        txLengthBuffer.writeUInt32BE(txBuffer.byteLength);
                        txBuffers.push(txLengthBuffer, txBuffer);
                    }
                }

                const blockEncoded = blocks.GetBlocksResponse.BlockHeader.encode({
                    ...block,
                    totalAmount: block.totalAmount.toString(),
                    totalFee: block.totalFee.toString(),
                    reward: block.reward.toString(),
                    transactions: Buffer.concat(txBuffers),
                }).finish();

                const blockBuffer = Buffer.from(blockEncoded);
                const blockLengthBuffer = Buffer.alloc(4);
                blockLengthBuffer.writeUInt32BE(blockBuffer.length);
                blockBuffers.push(blockLengthBuffer, blockBuffer);
            }

            return Buffer.concat(blockBuffers);
        },
        deserialise: (payload: Buffer): object => {
            const blocksBuffer = Buffer.from(payload);
            const blocksBuffers: Buffer[] = [];
            for (let offset = 0; offset < blocksBuffer.byteLength - 4; ) {
                const blockLength = blocksBuffer.readUInt32BE(offset);
                blocksBuffers.push(blocksBuffer.slice(offset + 4, offset + 4 + blockLength));
                offset += 4 + blockLength;
                if (blocksBuffers.length > hardLimitNumberOfBlocks) {
                    break;
                }
            }

            return blocksBuffers.map((blockBuffer) => {
                const blockWithTxBuffer = blocks.GetBlocksResponse.BlockHeader.decode(blockBuffer);
                const txsBuffer = Buffer.from(blockWithTxBuffer.transactions);
                const txs: string[] = [];
                for (let offset = 0; offset < txsBuffer.byteLength - 4; ) {
                    const txLength = txsBuffer.readUInt32BE(offset);
                    txs.push(txsBuffer.slice(offset + 4, offset + 4 + txLength).toString("hex"));
                    offset += 4 + txLength;
                    if (txs.length > hardLimitNumberOfTransactions) {
                        break;
                    }
                }
                return {
                    ...blockWithTxBuffer,
                    totalAmount: new Utils.BigNumber(blockWithTxBuffer.totalAmount),
                    totalFee: new Utils.BigNumber(blockWithTxBuffer.totalFee),
                    reward: new Utils.BigNumber(blockWithTxBuffer.reward),
                    transactions: txs,
                };
            });
        },
    },
};

export const postBlock = {
    request: {
        serialise: (obj: blocks.IPostBlockRequest): Buffer => Buffer.from(blocks.PostBlockRequest.encode(obj).finish()),
        deserialise: (payload: Buffer): object => {
            const decoded = blocks.PostBlockRequest.decode(payload);
            return {
                ...decoded,
                block: Buffer.from(decoded.block),
            };
        },
    },
    response: {
        serialise: (obj: blocks.IPostBlockResponse): Buffer => {
            return Buffer.from(blocks.PostBlockResponse.encode(obj).finish());
        },
        deserialise: (payload: Buffer): Contracts.P2P.PostBlockResponse => {
            return blocks.PostBlockResponse.decode(payload);
        },
    },
};
