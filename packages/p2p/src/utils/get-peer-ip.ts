import { Socket } from "../hapi-nes/socket";

export const getPeerIp = (socket: Socket): string => {
    return socket.info["x-forwarded-for"]?.split(",")[0]?.trim() ?? socket.info.remoteAddress;
};
