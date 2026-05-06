/**
 * @file `form` prompt. Sequenced single-line inputs — one per field —
 * collected into an object keyed by `field.name` and persisted as JSON.
 */

import type { FormComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { flatText } from "../../tui/theme.js"
import { awaitInputLine, persist, renderMessage } from "./promptUtils.js"

/**
 * Run each form field as a separate inline input, resolving with an
 * object keyed by `field.name`. Cancellation on any field aborts the
 * whole form (no partial persistence).
 *
 * @param component Form component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once every field has been submitted
 *   or the user cancels.
 */
export async function runForm(
    component: FormComponent,
    ctx: ComponentContext
): Promise<void> {
    const heading = renderMessage(component.message, ctx)
    ctx.tui.addChild(flatText(heading))
    ctx.tui.requestRender()

    const result: Record<string, string> = {}
    for (const field of component.choices) {
        const fieldMessage = renderMessage(field.message, ctx)
        const value = await awaitInputLine(
            ctx.tui,
            fieldMessage,
            field.initial ?? ""
        )
        if (value === undefined) return
        result[field.name] = value
    }
    persist(ctx.variables, component.name, result)
}
