/**
 * @file Shared execution context threaded through every component handler.
 *
 * Components are functions of the shape `(component, ctx) => Promise<void>`.
 * They mount pi-tui `Component`s onto the shared `TUI` for rendering, read
 * argv values for interpolation, and write back to the `VariableStore` when
 * resolving prompts. `run` is provided by the dispatcher (lives in
 * `src/commands/runComponents.ts` from 2.F onward) so recursive components
 * such as `conditional` can dispatch a sub-list without depending directly
 * on the dispatcher module.
 */

import type { TUI } from "@mariozechner/pi-tui"
import type { Component as ProtoComponent } from "../types/commands.js"
import type { VariableStore } from "../shell/VariableStore.js"

/** Function shape implemented by the dispatcher and consumed by `conditional`. */
export type ComponentRunner = (
    components: ProtoComponent | ProtoComponent[],
    ctx: ComponentContext
) => Promise<void>

/**
 * Per-handler context. Every component function receives this. Tests pass a
 * minimal context built around a `VirtualTerminal` + `TUI`; production code
 * builds it inside `Protostar`.
 */
export interface ComponentContext {
    /** Shared TUI instance; components add children here to render output. */
    tui: TUI
    /** Yargs-parsed argument values for the running command. */
    argv: Record<string, unknown>
    /** Variable store shared across the whole shell session. */
    variables: VariableStore
    /** Recursive dispatcher used by `conditional` to run sub-trees. */
    run: ComponentRunner
}
