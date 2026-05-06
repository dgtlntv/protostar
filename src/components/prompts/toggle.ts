/**
 * @file `toggle` prompt — boolean prompt with custom enabled/disabled
 * labels. Same shape as `confirm`, but the labels come from the schema.
 */

import { SelectList } from "@mariozechner/pi-tui"
import type { SelectListTheme } from "@mariozechner/pi-tui"
import { accentColor, mutedColor } from "../../tui/theme.js"
import type { ToggleComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { persist, renderMessage, runInline } from "./promptUtils.js"

const THEME: SelectListTheme = {
    selectedPrefix: (t) => accentColor(t),
    selectedText: (t) => accentColor(t),
    description: (t) => mutedColor(t),
    scrollInfo: (t) => mutedColor(t),
    noMatch: (t) => mutedColor(t),
}

/**
 * Two-state toggle with author-supplied labels. Resolves to a boolean and
 * persists `"true"` / `"false"`.
 *
 * @param component Toggle component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user picks one option or
 *   cancels.
 */
export async function runToggle(
    component: ToggleComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const items = [
        { value: "true", label: component.enabled },
        { value: "false", label: component.disabled },
    ]
    const list = new SelectList(items, 2, THEME)
    const value = await runInline<boolean>(ctx.tui, message, list, (done) => {
        list.onSelect = (item) =>
            done(item.value === "true", item.label)
        list.onCancel = () => done(undefined, null)
    })
    if (value !== undefined) persist(ctx.variables, component.name, String(value))
}
