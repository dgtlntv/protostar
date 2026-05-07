/**
 * @file `list` prompt. Reads a single line and splits it on commas with
 * trimmed segments.
 */

import type { ListComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { persist, renderMessage, runInlinePrompt } from "./promptUtils.js"

/**
 * Prompt for a comma-separated list. The submitted line is split on `,`
 * with each segment trimmed; the resulting array is JSON-stringified into
 * the variable store so downstream `interpolate` calls see a stable form.
 *
 * @param component List component definition.
 * @param ctx Shared execution context.
 */
export async function runList(
    component: ListComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const raw = await runInlinePrompt(ctx.tui, message)
    if (raw === undefined) return
    const items = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    persist(ctx.variables, component.name, items)
}
