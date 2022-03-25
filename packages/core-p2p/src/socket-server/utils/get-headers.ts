import { Container, Contracts, Providers } from "@solar-network/core-kernel";

export const getHeaders = (
    app: Contracts.Kernel.Application,
): { version: string | undefined; port: number | undefined; height: number | undefined } => {
    const headers: {
        version: string | undefined;
        port: number | undefined;
        height: number | undefined;
    } = {
        version: app.version(),
        port: Number(
            app
                .getTagged<Providers.PluginConfiguration>(
                    Container.Identifiers.PluginConfiguration,
                    "plugin",
                    "@solar-network/core-p2p",
                )
                .get<number>("port"),
        ),
        height: undefined,
    };

    const state: Contracts.State.StateStore = app.get<Contracts.State.StateStore>(Container.Identifiers.StateStore);
    if (state.isStarted()) {
        headers.height = app
            .get<Contracts.Blockchain.Blockchain>(Container.Identifiers.BlockchainService)
            .getLastHeight();
    }

    return headers;
};
