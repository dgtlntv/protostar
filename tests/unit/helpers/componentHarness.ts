/**
 * @file Test harness for the display components landing in 2.D. Wires a
 * `VirtualTerminal` to a real pi-tui `TUI`, owns a fresh `VariableStore`,
 * and provides a display-only dispatcher so `conditional` can recurse
 * during tests without depending on the 2.F dispatcher.
 */

import { TUI } from "@mariozechner/pi-tui"
import { VirtualTerminal } from "./virtualTerm.js"
import { VariableStore } from "../../../src/shell/VariableStore.js"
import type {
    ComponentContext,
    ComponentRunner,
} from "../../../src/components/context.js"
import { runText } from "../../../src/components/text.js"
import { runProgressBar } from "../../../src/components/progressBar.js"
import { runSpinner } from "../../../src/components/spinner.js"
import { runTable } from "../../../src/components/table.js"
import { runVariable } from "../../../src/components/variable.js"
import { runConditional } from "../../../src/components/conditional.js"

/**
 * Display-only dispatcher. Switches over the discriminator field and
 * forwards to the matching component handler. Throws on prompt component
 * types — those land in 2.E and aren't available here yet.
 */
export const dispatch: ComponentRunner = async (components, ctx) => {
    const list = Array.isArray(components) ? components : [components]
    for (const c of list) {
        switch (c.component) {
            case "text":
                await runText(c, ctx)
                break
            case "progressBar":
                await runProgressBar(c, ctx)
                break
            case "spinner":
                await runSpinner(c, ctx)
                break
            case "table":
                await runTable(c, ctx)
                break
            case "variable":
                await runVariable(c, ctx)
                break
            case "conditional":
                await runConditional(c, ctx)
                break
            default:
                throw new Error(
                    `Display harness: unsupported component '${c.component}'`
                )
        }
    }
}

/** Options for {@link makeHarness}. All fields default to sensible values. */
export interface HarnessOptions {
    variables?: Record<string, string>
    argv?: Record<string, unknown>
    columns?: number
    rows?: number
}

/**
 * Build a self-contained harness: virtual terminal + started TUI + variable
 * store + dispatcher-backed context. Tests dispatch components via
 * `harness.run(components)`.
 *
 * @param opts Harness options.
 * @returns The harness pieces needed by the spec.
 */
export function makeHarness(opts: HarnessOptions = {}) {
    const term = new VirtualTerminal(opts.columns ?? 80, opts.rows ?? 24)
    const tui = new TUI(term, false)
    tui.start()
    const variables = new VariableStore(opts.variables ?? {})
    const ctx: ComponentContext = {
        tui,
        argv: opts.argv ?? {},
        variables,
        run: dispatch,
    }
    return {
        term,
        tui,
        variables,
        ctx,
        run: (components: Parameters<ComponentRunner>[0]) =>
            dispatch(components, ctx),
    }
}

/**
 * Force an immediate TUI render (bypassing the 16ms throttle) and wait for
 * xterm to drain the resulting writes. Use this after dispatching a
 * non-animated component before reading the viewport.
 *
 * @param tui The TUI to flush.
 * @param term The underlying virtual terminal.
 * @returns A promise that resolves once writes have drained.
 */
export async function flushRender(
    tui: TUI,
    term: VirtualTerminal
): Promise<void> {
    tui.requestRender(true)
    // process.nextTick → doRender → terminal.write
    await new Promise<void>((resolve) => process.nextTick(resolve))
    await term.flush()
}
