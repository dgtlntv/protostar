/**
 * @file `multiSelect` prompt. Custom pi-tui `Component` that renders a
 * checkbox list, lets the user toggle items with Space, and submits an
 * array of `value`s on Enter.
 */

import type { Component, Focusable } from "@mariozechner/pi-tui"
import { accentColor, mutedColor, successColor } from "../../tui/theme.js"
import type {
    MultiSelectChoice,
    MultiSelectComponent,
} from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { persist, renderMessage, runInline } from "./promptUtils.js"

/**
 * Multi-pick list with a moveable cursor and per-item toggle state. Submit
 * resolves with the values of the currently-checked items in the order
 * they appear in `choices`.
 */
class MultiSelectList implements Component, Focusable {
    /** Set by TUI when focus changes. */
    focused = false
    private cursor = 0
    private readonly checked: boolean[]

    /** Invoked with the array of selected values on submit. */
    onSelect?: (values: string[]) => void
    /** Invoked when the user cancels. */
    onCancel?: () => void

    /**
     * @param items Choices in display order.
     * @param limit Maximum number of rows visible at a time.
     */
    constructor(
        private readonly items: MultiSelectChoice[],
        private readonly limit: number
    ) {
        this.checked = items.map(() => false)
    }

    /** Pi-tui input dispatch. */
    handleInput(data: string): void {
        if (data === "\x1b[A" || data === "\x1bOA") {
            this.cursor = Math.max(0, this.cursor - 1)
            return
        }
        if (data === "\x1b[B" || data === "\x1bOB") {
            this.cursor = Math.min(this.items.length - 1, this.cursor + 1)
            return
        }
        if (data === " ") {
            this.checked[this.cursor] = !this.checked[this.cursor]
            return
        }
        if (data === "\r" || data === "\n") {
            const picked = this.items
                .filter((_, i) => this.checked[i])
                .map((c) => c.value)
            this.onSelect?.(picked)
            return
        }
        if (data === "\x1b" || data === "\x03") {
            this.onCancel?.()
        }
    }

    /** No cached state. */
    invalidate(): void {}

    /**
     * Render the list, showing a window of `limit` rows around the cursor.
     *
     * @param _width Available width — unused; rows are short and we let
     *   the terminal handle hard wrapping if it must.
     * @returns Lines representing the visible window.
     */
    render(_width: number): string[] {
        const start = Math.max(
            0,
            Math.min(
                this.cursor - Math.floor(this.limit / 2),
                this.items.length - this.limit
            )
        )
        const end = Math.min(start + this.limit, this.items.length)
        const lines: string[] = []
        for (let i = start; i < end; i++) {
            const item = this.items[i]
            const cursor = i === this.cursor ? "→ " : "  "
            const box = this.checked[i] ? successColor("✔") : mutedColor("◯")
            const line = `${cursor}${box} ${item.name}`
            lines.push(i === this.cursor ? accentColor(line) : line)
        }
        if (this.items.length > this.limit) {
            lines.push(
                mutedColor(`  (${this.cursor + 1}/${this.items.length})`)
            )
        }
        return lines
    }
}

/**
 * Mount a checkbox list and resolve with the picked values. Persists the
 * result as a JSON-encoded array under `component.name`.
 *
 * @param component MultiSelect component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user submits or cancels.
 */
export async function runMultiSelect(
    component: MultiSelectComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const limit = component.limit ?? Math.min(component.choices.length, 8)
    const list = new MultiSelectList(component.choices, Math.max(1, limit))
    const values = await runInline<string[]>(ctx.tui, message, list, (done) => {
        list.onSelect = (picked) => done(picked, picked.join(", "))
        list.onCancel = () => done(undefined, null)
    })
    if (values !== undefined) persist(ctx.variables, component.name, values)
}
