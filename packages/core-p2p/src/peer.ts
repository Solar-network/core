import { Contracts } from "@solar-network/core-kernel";
import dayjs, { Dayjs } from "dayjs";

import { PeerVerificationResult } from "./peer-verifier";

/**
 * @export
 * @class Peer
 * @implements {Contracts.P2P.Peer}
 */
export class Peer implements Contracts.P2P.Peer {
    /**
     * @type {Contracts.P2P.PeerPorts}
     * @memberof Peer
     */
    public readonly ports: Contracts.P2P.PeerPorts = {};

    /**
     * @type {(string | undefined)}
     * @memberof Peer
     */
    public version: string | undefined;

    /**
     * @type {(Set<number>)}
     * @memberof Peer
     */
    public infractions: Set<number> = new Set();

    /**
     * @type {(number | undefined)}
     * @memberof Peer
     */
    public latency: number | undefined;

    /**
     * @type {(Dayjs | undefined)}
     * @memberof Peer
     */
    public lastPinged: Dayjs | undefined;

    /**
     * @type {(string[])}
     * @memberof Peer
     */
    public publicKeys: string[] = [];

    /**
     * @type {(number)}
     * @memberof Peer
     */
    public sequentialErrorCounter: number = 0;

    /**
     * @type {(string[])}
     * @memberof Peer
     */
    public signatures: string[] = [];

    /**
     * @type {(PeerVerificationResult | undefined)}
     * @memberof Peer
     */
    public verificationResult: PeerVerificationResult | undefined;

    /**
     * @type {(boolean)}
     * @memberof Peer
     */
    public stale: boolean = true;

    /**
     * @type {Contracts.P2P.PeerState}
     * @memberof Peer
     */
    public state: Contracts.P2P.PeerState = {
        height: undefined,
        forgingAllowed: undefined,
        currentSlot: undefined,
        header: {},
    };

    /**
     * @type {Contracts.P2P.PeerPlugins}
     * @memberof Peer
     */
    public plugins: Contracts.P2P.PeerPlugins = {};

    /**
     * @param {string} ip
     * @param {number} port
     * @memberof Peer
     */
    public constructor(public readonly ip: string, public readonly port: number) {}

    /**
     * @readonly
     * @type {string}
     * @memberof Peer
     */
    public get url(): string {
        return `${this.port % 443 === 0 ? "https://" : "http://"}${this.ip}:${this.port}`;
    }

    /**
     * @returns {boolean}
     * @memberof Peer
     */
    public isVerified(): boolean {
        return this.verificationResult instanceof PeerVerificationResult;
    }

    /**
     * @returns {boolean}
     * @memberof Peer
     */
    public isForked(): boolean {
        return !!(this.isVerified() && this.verificationResult && this.verificationResult.forked);
    }

    /**
     * @returns {boolean}
     * @memberof Peer
     */
    public isActiveDelegate(): boolean {
        return this.publicKeys.length > 0;
    }

    /**
     * @returns {boolean}
     * @memberof Peer
     */
    public recentlyPinged(): boolean {
        return !!this.lastPinged && dayjs().diff(this.lastPinged, "minute") < 2;
    }

    /**
     * @returns {Contracts.P2P.PeerBroadcast}
     * @memberof Peer
     */
    public toBroadcast(): Contracts.P2P.PeerBroadcast {
        return {
            ip: this.ip,
            port: this.port,
        };
    }

    public addInfraction(): void {
        const timeNow: number = new Date().getTime() / 1000;
        this.infractions.add(timeNow);
    }

    public isIgnored(): boolean {
        const timeNow: number = new Date().getTime() / 1000;
        for (const infraction of this.infractions) {
            if (timeNow - infraction > 600) {
                this.infractions.delete(infraction);
            }
        }
        return this.infractions.size >= 3;
    }
}
