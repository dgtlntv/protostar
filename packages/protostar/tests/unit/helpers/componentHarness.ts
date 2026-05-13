/**
 * @file Test harness for the display and prompt components. Wires a
 * `VirtualTerminal` to a real pi-tui `TUI`, owns a fresh `VariableStore`,
 * and dispatches across the full component switch so `conditional` can
 * recurse during tests without depending on the production dispatcher.
 */

import { TUI } from "@earendil-works/pi-tui"
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
import {
    runInput,
    runInvisible,
    runNumber,
    runPassword,
} from "../../../src/components/prompts/input.js"
import { runList } from "../../../src/components/prompts/list.js"
import {
    runAutoComplete,
    runSelect,
} from "../../../src/components/prompts/select.js"
import { runMultiSelect } from "../../../src/components/prompts/multiSelect.js"
import { runConfirm } from "../../../src/components/prompts/confirm.js"
import { runToggle } from "../../../src/components/prompts/toggle.js"
import { runForm } from "../../../src/components/prompts/form.js"
import { runBasicAuth } from "../../../src/components/prompts/basicAuth.js"
import { runSort } from "../../../src/components/prompts/sort.js"

/**
 * Full dispatcher: switches over the discriminator field and forwards to
 * the matching component handler. Mirrors the production dispatcher in
 * `src/commands/runComponents.ts`.
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
            case "input":
                await runInput(c, ctx)
                break
            case "number":
                await runNumber(c, ctx)
                break
            case "password":
                await runPassword(c, ctx)
                break
            case "invisible":
                await runInvisible(c, ctx)
                break
            case "list":
                await runList(c, ctx)
                break
            case "select":
                await runSelect(c, ctx)
                break
            case "autoComplete":
                await runAutoComplete(c, ctx)
                break
            case "multiSelect":
                await runMultiSelect(c, ctx)
                break
            case "confirm":
                await runConfirm(c, ctx)
                break
            case "toggle":
                await runToggle(c, ctx)
                break
            case "form":
                await runForm(c, ctx)
                break
            case "basicAuth":
                await runBasicAuth(c, ctx)
                break
            case "sort":
                await runSort(c, ctx)
                break
            default: {
                const exhaustive: never = c
                throw new Error(
                    `Component harness: unsupported component '${(exhaustive as { component: string }).component}'`
                )
            }
        }
    }
}

/** Options for {@link makeHarness}. All fields default to sensible values. */
export interface HarnessOptions {
    variables?: Record<string, string>
    argv?: Record<string, unknown>
    columns?: number
    rows?: number
    /** Optional cancel signal threaded into the component context. */
    signal?: AbortSignal
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
        signal: opts.signal,
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
