import * as ipAddr from "ipaddr.js";

export const mapAddr = (addr: string): string => ipAddr.process(addr).toString();
