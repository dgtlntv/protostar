/**
 * @file `confirm` prompt — yes/no question. Uses a `SelectList[Yes/No]` so
 * keyboard navigation matches the rest of the select-style prompts.
 */

import { SelectList } from "@mariozechner/pi-tui"
import type { SelectListTheme } from "@mariozechner/pi-tui"
import { accentColor, mutedColor } from "../../tui/theme.js"
import type { ConfirmComponent } from "../../types/commands.js"
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
 * Yes/no confirmation. Resolves to a boolean and persists `"true"` /
 * `"false"` under `component.name`.
 *
 * @param component Confirm component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user picks Yes/No or cancels.
 */
export async function runConfirm(
    component: ConfirmComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const items = [
        { value: "true", label: "Yes" },
        { value: "false", label: "No" },
    ]
    const list = new SelectList(items, 2, THEME)
    if (component.initial === false) list.setSelectedIndex(1)
    const value = await runInline<boolean>(ctx.tui, message, list, (done) => {
        list.onSelect = (item) =>
            done(item.value === "true", item.label)
        list.onCancel = () => done(undefined, null)
    })
    if (value !== undefined) persist(ctx.variables, component.name, String(value))
}
