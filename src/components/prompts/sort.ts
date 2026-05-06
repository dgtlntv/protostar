/**
 * @file `sort` prompt. Lets the user reorder a list: arrow keys navigate,
 * Space toggles "grab" mode, and while grabbed arrow keys move the active
 * item up/down. Enter submits the reordered list.
 */

import type { Component, Focusable } from "@mariozechner/pi-tui"
import { accentColor, mutedColor } from "../../tui/theme.js"
import type { SortComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { persist, renderMessage, runInline } from "./promptUtils.js"

/**
 * Reorderable list. State is the current order of items (a `string[]`)
 * plus the cursor index and a "grabbed" flag controlling whether arrow
 * keys move the cursor or move the active item.
 */
class SortList implements Component, Focusable {
    /** Set by TUI when focus changes. */
    focused = false
    private cursor = 0
    private grabbed = false
    private readonly order: string[]

    /** Invoked with the reordered list on submit. */
    onSelect?: (order: string[]) => void
    /** Invoked when the user cancels. */
    onCancel?: () => void

    /** @param items Initial order of choices. */
    constructor(items: string[]) {
        this.order = [...items]
    }

    private moveUp(): void {
        if (this.cursor === 0) return
        if (this.grabbed) {
            const tmp = this.order[this.cursor - 1]
            this.order[this.cursor - 1] = this.order[this.cursor]
            this.order[this.cursor] = tmp
        }
        this.cursor -= 1
    }

    private moveDown(): void {
        if (this.cursor >= this.order.length - 1) return
        if (this.grabbed) {
            const tmp = this.order[this.cursor + 1]
            this.order[this.cursor + 1] = this.order[this.cursor]
            this.order[this.cursor] = tmp
        }
        this.cursor += 1
    }

    /** Pi-tui input dispatch. */
    handleInput(data: string): void {
        if (data === "\x1b[A" || data === "\x1bOA") {
            this.moveUp()
            return
        }
        if (data === "\x1b[B" || data === "\x1bOB") {
            this.moveDown()
            return
        }
        if (data === " ") {
            this.grabbed = !this.grabbed
            return
        }
        if (data === "\r" || data === "\n") {
            this.onSelect?.([...this.order])
            return
        }
        if (data === "\x1b" || data === "\x03") {
            this.onCancel?.()
        }
    }

    /** No cached state. */
    invalidate(): void {}

    /**
     * Render the list, marking the active row with a cursor glyph and the
     * grabbed state with a different prefix so users can tell which mode
     * they're in.
     *
     * @param _width Ignored.
     * @returns Lines for the current order.
     */
    render(_width: number): string[] {
        const lines = this.order.map((item, i) => {
            const isCursor = i === this.cursor
            const prefix = !isCursor ? "  " : this.grabbed ? "↕ " : "→ "
            const line = `${prefix}${item}`
            return isCursor ? accentColor(line) : line
        })
        const hint = this.grabbed
            ? "(grabbed — ↑/↓ to reorder, Space to drop, Enter to submit)"
            : "(↑/↓ to move, Space to grab, Enter to submit)"
        lines.push(mutedColor(`  ${hint}`))
        return lines
    }
}

/**
 * Mount a reorderable list and resolve with the user's chosen order.
 *
 * @param component Sort component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user submits or cancels.
 */
export async function runSort(
    component: SortComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const list = new SortList(component.choices)
    const order = await runInline<string[]>(ctx.tui, message, list, (done) => {
        list.onSelect = (o) => done(o, o.join(", "))
        list.onCancel = () => done(undefined, null)
    })
    if (order !== undefined) persist(ctx.variables, component.name, order)
}
