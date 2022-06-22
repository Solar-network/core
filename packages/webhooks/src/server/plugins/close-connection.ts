import { isBoom } from "@hapi/boom";
import { Server } from "@hapi/hapi";

export const closeConnection = {
    name: "closeConnection",
    version: "1.0.0",
    register(server: Server): void {
        server.ext({
            type: "onPreResponse",
            async method(request, h) {
                if (isBoom(request.response)) {
                    return h
                        .response(request.response.output.payload)
                        .header("connection", "close")
                        .code(request.response.output.statusCode);
                }

                return h.response(request.response).header("connection", "close");
            },
        });
    },
};
