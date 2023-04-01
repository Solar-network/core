export class NotTaggedError extends Error {
    public constructor() {
        super("No package tag specified for logger instance");
    }
}
