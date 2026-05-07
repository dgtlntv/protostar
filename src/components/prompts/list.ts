/**
 * @file `list` prompt. Reads a single line and splits it on commas with
 * trimmed segments.
 */

import type { ListComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { awaitInputLine, persist, renderMessage } from "./promptUtils.js"

/**
 * Prompt for a comma-separated list. The submitted line is split on `,`
 * with each segment trimmed; the resulting array is JSON-stringified into
 * the variable store so downstream `interpolate` calls see a stable form.
 *
 * @param component List component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user submits or cancels.
 */
export async function runList(
    component: ListComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const raw = await awaitInputLine(ctx.tui, message)
    if (raw === undefined) return
    const items = raw
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    persist(ctx.variables, component.name, items)
}
