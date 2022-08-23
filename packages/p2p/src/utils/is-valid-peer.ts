import * as ipAddr from "ipaddr.js";
import os from "os";

const isUnicast = (ip: string): boolean => {
    try {
        const parsed = ipAddr.parse(ip);
        if (parsed.range() === "unicast" && !ip.startsWith("0")) {
            return true;
        }
        return false;
    } catch (error) {
        return false;
    }
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

    if (!isUnicast(peer.ip)) {
        return false;
    }

    if (includeNetworkInterfaces && networkInterfaces(peer.ip)) {
        return false;
    }

    return true;
};
