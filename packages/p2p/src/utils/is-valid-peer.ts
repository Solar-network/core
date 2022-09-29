import * as ipAddr from "ipaddr.js";
import os from "os";

const validRanges = ["unicast"];

if (process.env.SOLAR_CORE_P2P_ALLOW_PRIVATE_IP_RANGES?.toLowerCase() === "true") {
    validRanges.push(...["linkLocal", "private", "uniqueLocal"]);
}

const isValidRange = (ip: string): boolean => {
    try {
        const parsed = ipAddr.parse(ip);
        return !ip.startsWith("0") && validRanges.includes(parsed.range());
    } catch {
        //
    }
    return false;
};

const networkInterfaces = (ip: string): boolean => {
    const interfaces = os.networkInterfaces();

    return Object.keys(interfaces).some((ifname) => interfaces[ifname]!.some((iface) => iface.address === ip));
};

const sanitiseRemoteAddress = (ip: string): string | undefined => {
    try {
        return ipAddr.process(ip).toString();
    } catch (error) {
        return undefined;
    }
};

export const isValidPeer = (
    peer: { ip: string; status?: string | number },
    includeNetworkInterfaces: boolean = true,
): boolean => {
    const sanitisedAddress: string | undefined = sanitiseRemoteAddress(peer.ip);

    if (!sanitisedAddress) {
        return false;
    }

    peer.ip = sanitisedAddress;

    if (!isValidRange(peer.ip)) {
        return false;
    }

    if (includeNetworkInterfaces && networkInterfaces(peer.ip)) {
        return false;
    }

    return true;
};
