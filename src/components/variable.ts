/**
 * @file `variable` component. Writes one or more entries from
 * `component.output` into the shared `VariableStore`. Undeclared keys are
 * surfaced as a warning line on the TUI rather than thrown, so a typo in
 * one assignment doesn't tear down the rest of the component pipeline.
 */

import type { VariableComponent } from "../types/commands.js"
import { LOG_SYMBOLS, flatText } from "../tui/theme.js"
import type { ComponentContext } from "./context.js"

/**
 * Apply each `component.output[key] = value` assignment to the variable
 * store. Rejected (undeclared) keys are reported as warning lines but do
 * not stop the run.
 *
 * @param component The variable component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once all assignments have been attempted.
 */
export async function runVariable(
    component: VariableComponent,
    ctx: ComponentContext
): Promise<void> {
    for (const [key, value] of Object.entries(component.output)) {
        const result = ctx.variables.set(key, value)
        if (!result.ok) {
            ctx.tui.addChild(
                flatText(
                    `${LOG_SYMBOLS.warning} Attempt to set undeclared variable '${result.key}'`
                )
            )
        }
    }
    ctx.tui.requestRender()
}
