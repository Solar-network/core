import { transactions } from "./proto/protos";

// actual max transactions is enforced by schema but we set a hard limit for deserialising (way higher than in schema)
const hardLimitNumberOfTransactions = 1000;

const serialiseTransactions = (
    encode: Function,
    obj: transactions.IPostTransactionsRequest | transactions.IGetUnconfirmedTransactionsResponse,
): Buffer => {
    const size = (obj.transactions as unknown as Buffer[]).reduce((sum: number, tx: Buffer) => sum + 4 + tx.length, 0);
    const result = Buffer.alloc(size);

    let offset = 0;
    for (const tx of obj.transactions as unknown as Buffer[]) {
        offset = result.writeUInt32BE(tx.length, offset);
        offset += tx.copy(result, offset);
    }

    obj = { ...obj, transactions: result };

    return Buffer.from(encode(obj).finish());
};

const deserialiseTransactions = (decode: Function, payload: Buffer): object => {
    const decoded = decode(payload);
    const txsBuffer = Buffer.from(decoded.transactions);
    const txs: Buffer[] = [];
    for (let offset = 0; offset < txsBuffer.byteLength - 4; ) {
        const txLength = txsBuffer.readUInt32BE(offset);
        txs.push(txsBuffer.slice(offset + 4, offset + 4 + txLength));
        offset += 4 + txLength;
        if (txs.length > hardLimitNumberOfTransactions) {
            break;
        }
    }

    return {
        ...decoded,
        transactions: txs,
    };
};

export const getUnconfirmedTransactions = {
    request: {
        serialise: (obj: transactions.GetUnconfirmedTransactionsRequest): Buffer =>
            Buffer.from(transactions.GetUnconfirmedTransactionsRequest.encode(obj).finish()),
        deserialise: (payload: Buffer): {} => transactions.GetUnconfirmedTransactionsRequest.decode(payload),
    },
    response: {
        serialise: (obj: transactions.IGetUnconfirmedTransactionsResponse): Buffer =>
            serialiseTransactions(transactions.GetUnconfirmedTransactionsResponse.encode, obj),
        deserialise: (payload: Buffer): object =>
            deserialiseTransactions(transactions.GetUnconfirmedTransactionsResponse.decode, payload),
    },
};

export const postTransactions = {
    request: {
        serialise: (obj: transactions.IPostTransactionsRequest): Buffer =>
            serialiseTransactions(transactions.PostTransactionsRequest.encode, obj),
        deserialise: (payload: Buffer): object =>
            deserialiseTransactions(transactions.PostTransactionsRequest.decode, payload),
    },
    response: {
        serialise: (accept: string[]): Buffer =>
            Buffer.from(transactions.PostTransactionsResponse.encode({ accept }).finish()),
        deserialise: (payload: Buffer): object => transactions.PostTransactionsResponse.decode(payload).accept,
    },
};
