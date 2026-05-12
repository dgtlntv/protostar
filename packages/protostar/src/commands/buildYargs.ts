/**
 * @file Builds a yargs command tree from a `Commands` config and binds each
 * leaf to the component-list dispatcher in `runComponents`. Mechanical port
 * of the legacy `commandsToYargs.js`.
 */

import Yargs from "yargs/browser"
// `yargs/browser` has no shipped types; the runtime shape we use is a small
// subset of the documented yargs API, so a structural type captures it.
type YargsInstance = ReturnType<typeof Yargs>

import type {
    Command,
    Commands,
} from "../types/commands.js"
import type { ComponentContext, ComponentRunner } from "../components/context.js"
import type { TUI } from "@earendil-works/pi-tui"
import type { VariableStore } from "../shell/VariableStore.js"
import type { XtermTerminalAdapter } from "../tui/XtermTerminal.js"
import { flatText } from "../tui/theme.js"
import { isCommandCanceledError } from "../shell/CommandCanceledError.js"

/**
 * Hooks the yargs handler binding needs in order to run components and
 * service built-in commands. Provided by `Protostar` at construction time.
 */
export interface BuildYargsContext {
    /** Owning TUI — components mount here. */
    tui: TUI
    /** Variable store shared across the session. */
    variables: VariableStore
    /** Component-list dispatcher (see `runComponents`). */
    run: ComponentRunner
    /** Adapter used to service the built-in `clear` command. */
    terminal: XtermTerminalAdapter
    /**
     * Returns the cancel signal for the current dispatch, or `undefined`
     * when no dispatch is active. Threaded into each handler's
     * {@link ComponentContext} so long-running components can listen for
     * Ctrl+C. Resolved at handler-invocation time so the closure works
     * even though the shell loop holding the AbortController is
     * constructed after `buildYargs` runs.
     */
    getSignal?: () => AbortSignal | undefined
}

/**
 * Build a fresh, configured yargs instance from `commands`.
 *
 * Mirrors the legacy behaviour:
 * - `--help` / unknown commands are routed through `.fail` and printed via the
 *   TUI rather than `process.stderr`.
 * - Each leaf command's `handler` is run as a component list against the
 *   shared `ComponentContext`.
 * - The implicit `clear` command calls `terminal.clearScreen()`.
 *
 * @param commands Parsed `commands.json` shape.
 * @param ctx Wiring pulled from the surrounding `Protostar`.
 * @returns A configured yargs instance ready for `.parse(argv, callback)`.
 */
export function buildYargs(
    commands: Commands,
    ctx: BuildYargsContext
): YargsInstance {
    const yargs: YargsInstance = Yargs()
        .usageConfiguration({ "hide-types": true })
        .demandCommand(1, "You need to specify a command.")
        .strict()
        .fail((msg: string, _err: Error, y: YargsInstance) => {
            if (msg) {
                ctx.tui.addChild(flatText(msg))
            }
            y.showHelp((help: string) => {
                ctx.tui.addChild(flatText(help))
                ctx.tui.requestRender()
            })
        })

    buildCommands(yargs, commands.commands, ctx)

    yargs.command(
        "clear",
        "Clears the terminal",
        () => {},
        () => {
            ctx.terminal.clearScreen()
            ctx.tui.clear()
            ctx.tui.requestRender()
        }
    )

    return yargs
}

/**
 * Recursively register `commands` on the given yargs (sub-)builder.
 *
 * @param yargs Yargs builder to attach commands to.
 * @param commands Map of command name → definition.
 * @param ctx Shared wiring forwarded to every handler.
 */
function buildCommands(
    yargs: YargsInstance,
    commands: Record<string, Command>,
    ctx: BuildYargsContext
): void {
    for (const [name, def] of Object.entries(commands)) {
        yargs.command(
            name,
            def.description ?? def.desc ?? def.describe ?? "",
            (y: YargsInstance) => configureBuilder(name, def, y, ctx),
            def.handler ? makeHandler(def, ctx) : (_argv: unknown) => yargs.showHelp()
        )
    }
}

/**
 * Apply a command's aliases, positionals, options, examples, and subcommands
 * onto the given yargs (sub-)builder.
 *
 * @param name Outer command name (used to register aliases).
 * @param def Command definition.
 * @param y Yargs sub-builder for this command.
 * @param ctx Shared wiring forwarded to nested commands.
 * @returns The same builder, for chaining.
 */
function configureBuilder(
    name: string,
    def: Command,
    y: YargsInstance,
    ctx: BuildYargsContext
): YargsInstance {
    if (def.alias) {
        const aliases = Array.isArray(def.alias) ? def.alias : [def.alias]
        for (const alias of aliases) y.alias(name, alias)
    }
    if (def.positional) {
        for (const [argName, argConfig] of Object.entries(def.positional)) {
            y.positional(argName, argConfig)
        }
    }
    if (def.options) {
        for (const [optName, optConfig] of Object.entries(def.options)) {
            y.option(optName, optConfig)
        }
    }
    if (def.example) {
        const examples = Array.isArray(def.example[0])
            ? (def.example as [string, string][])
            : [def.example as [string, string]]
        for (const [cmd, desc] of examples) y.example(cmd, desc)
    }
    if (def.commands) {
        buildCommands(y, def.commands, ctx)
    }
    return y
}

/**
 * Build a yargs handler that dispatches the command's component list through
 * the shared runner. Errors raised by components are surfaced to the console
 * — the shell loop continues regardless so a single broken component cannot
 * wedge the prompt.
 *
 * @param def Command definition (must have `handler`).
 * @param ctx Shared wiring.
 * @returns An async yargs handler.
 */
function makeHandler(
    def: Command,
    ctx: BuildYargsContext
): (argv: Record<string, unknown>) => Promise<void> {
    const handler = def.handler!
    return async (argv) => {
        const componentCtx: ComponentContext = {
            tui: ctx.tui,
            argv,
            variables: ctx.variables,
            run: ctx.run,
            signal: ctx.getSignal?.(),
        }
        try {
            await ctx.run(handler, componentCtx)
        } catch (error) {
            // Cancellation is expected when the user pressed Ctrl+C —
            // `ShellLoop.cancelDispatch` already wrote `^C` and aborted
            // every subscribing component; the sentinel only exists to
            // unwind the runComponents loop. Swallow it here so it does
            // not reach yargs's `.fail` (which would render the help
            // banner on every cancel). Other errors stay logged so a
            // single broken component cannot wedge the prompt.
            if (!isCommandCanceledError(error)) {
                console.error("Error in command handler:", error)
            }
        }
    }
}
