/**
 * @file `snippet` prompt. Sequentially asks for each `field`, then renders
 * the `template` with `${field.name}` placeholders replaced by the
 * collected values.
 */

import type { SnippetComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { flatText } from "../../tui/theme.js"
import { awaitInputLine, persist, renderMessage } from "./promptUtils.js"

/** Replace every `${name}` in `template` with the value from `values`. */
function applyTemplate(
    template: string,
    values: Record<string, string>
): string {
    return template.replace(/\$\{(\w+)\}/g, (_, name) => values[name] ?? "")
}

/**
 * Prompt for each field in order, then render the template with the
 * collected values and persist the result. Cancellation aborts the whole
 * snippet (no partial persistence).
 *
 * @param component Snippet component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once every field has been answered or
 *   the user cancels.
 */
export async function runSnippet(
    component: SnippetComponent,
    ctx: ComponentContext
): Promise<void> {
    const heading = renderMessage(component.message, ctx)
    ctx.tui.addChild(flatText(heading))
    ctx.tui.requestRender()

    const values: Record<string, string> = {}
    for (const field of component.fields) {
        const fieldMessage = renderMessage(field.message, ctx)
        const value = await awaitInputLine(ctx.tui, fieldMessage)
        if (value === undefined) return
        values[field.name] = value
    }
    const rendered = applyTemplate(component.template, values)
    ctx.tui.addChild(flatText(rendered))
    ctx.tui.requestRender()
    persist(ctx.variables, component.name, rendered)
}
