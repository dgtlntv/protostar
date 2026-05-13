/**
 * @file `conditional` component. Evaluates `output.if` via the safelisted
 * `evalCondition`, then dispatches the matching `then`/`else` branch
 * through `ctx.run`.
 */

import type { ConditionalComponent } from "../types/commands.js"
import { evalCondition } from "../shell/evalCondition.js"
import type { ComponentContext } from "./context.js"

/**
 * Evaluate `component.output.if` against the merged `{ ...argv, ...variables }`
 * context and run `then` or `else` accordingly. If the expression is
 * falsy and no `else` branch exists, the call is a no-op.
 *
 * @param component The conditional component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the chosen branch finishes.
 */
export async function runConditional(
    component: ConditionalComponent,
    ctx: ComponentContext
): Promise<void> {
    const branch = evalCondition(component.output.if, {
        ...ctx.variables.entries(),
        ...ctx.argv,
    })
        ? component.output.then
        : component.output.else

    if (branch !== undefined) {
        await ctx.run(branch, ctx)
    }
}
