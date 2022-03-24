import { RateLimiter } from "../rate-limiter";

export const buildRateLimiter = (options: {
    isOutgoing?: boolean;
    whitelist: string[];
    rateLimit: number;
    rateLimitPostTransactions: number;
    remoteAccess: string[];
}): RateLimiter =>
    new RateLimiter({
        whitelist: [...options.whitelist, ...options.remoteAccess],
        configurations: {
            global: {
                rateLimit: options.rateLimit,
            },
            endpoints: [
                {
                    rateLimit: 2,
                    duration: options.isOutgoing ? 4 : 2,
                    endpoint: "p2p.blocks.postBlock",
                },
                {
                    rateLimit: options.isOutgoing ? 1 : 2,
                    duration: options.isOutgoing ? 2 : 1,
                    endpoint: "p2p.blocks.getBlocks",
                },
                {
                    rateLimit: options.isOutgoing ? 1 : 2,
                    endpoint: "p2p.peer.getPeers",
                },
                {
                    rateLimit: 9,
                    endpoint: "p2p.peer.getStatus",
                },
                {
                    rateLimit: 9,
                    endpoint: "p2p.peer.getCommonBlocks",
                },
                {
                    rateLimit: options.rateLimitPostTransactions || 25,
                    endpoint: "p2p.transactions.postTransactions",
                },
            ],
        },
    });
