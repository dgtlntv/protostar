/**
 * @file Sentinel error thrown by {@link runComponents} when the in-flight
 * command's {@link AbortSignal} fires (Ctrl+C). The shell loop catches it
 * to render the `^C` echo and abandon the rest of the handler list without
 * surfacing a stack trace.
 */

/**
 * Thrown when component dispatch observes an aborted {@link AbortSignal}.
 * Carries no payload; the message is set to a stable string so external
 * matchers can rely on `error.name === "CommandCanceledError"`.
 */
export class CommandCanceledError extends Error {
    constructor() {
        super("command canceled")
        this.name = "CommandCanceledError"
    }
}

/**
 * Type guard for {@link CommandCanceledError}. Cheaper to use than
 * `instanceof` when the error may have crossed a boundary that lost the
 * prototype chain.
 *
 * @param error Value to inspect.
 * @returns `true` if `error` is a {@link CommandCanceledError}.
 */
export function isCommandCanceledError(error: unknown): error is CommandCanceledError {
    return (
        error instanceof CommandCanceledError ||
        (typeof error === "object" &&
            error !== null &&
            (error as { name?: unknown }).name === "CommandCanceledError")
    )
}
