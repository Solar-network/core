import { isBoom } from "@hapi/boom";
import Hapi from "@hapi/hapi";

export const closeConnection = {
    name: "close-connection",
    version: "1.0.0",

    register(server: Hapi.Server): void {
        server.ext("onPreResponse", this.onPreResponse);
    },

    onPreResponse(request: Hapi.Request, h: Hapi.ResponseToolkit): Hapi.Lifecycle.ReturnValue {
        if (isBoom(request.response)) {
            return h
                .response(request.response.output.payload)
                .header("connection", "close")
                .code(request.response.output.statusCode);
        }

        return h.response(request.response).header("connection", "close");
    },
};
