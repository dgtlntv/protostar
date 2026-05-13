/**
 * @file `confirm` prompt — yes/no question rendered as `? <message> (Y/n)`
 * (or `(y/N)` when `initial === false`). Resolves the moment the user
 * presses `y`/`Y`/`n`/`N`, or treats Enter as accepting the highlighted
 * default. Matches the legacy enquirer keystroke flow.
 */

import { CURSOR_MARKER, visibleWidth } from "@earendil-works/pi-tui"
import type { Component, Focusable } from "@earendil-works/pi-tui"
import { promptOpenColor } from "../../tui/theme.js"
import type { ConfirmComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { persist, renderMessage, runInline } from "./promptUtils.js"

/**
 * Custom focusable that renders the `(Y/n)` hint and resolves on a single
 * key press. Either `y`/`Y` or Enter (when default is `true`) resolves to
 * `true`; either `n`/`N` or Enter (when default is `false`) resolves to
 * `false`. Escape cancels; Ctrl+C is handled centrally.
 */
class ConfirmKey implements Component, Focusable {
    /** Set by TUI when focus changes. */
    focused = false

    /** Invoked with the picked boolean and its rendered label. */
    onSelect?: (value: boolean, label: string) => void
    /** Invoked when the user cancels. */
    onCancel?: () => void

    private readonly prefix: string
    private readonly hint: string

    /**
     * @param message Pre-interpolated message text.
     * @param defaultValue Default applied when the user presses Enter.
     */
    constructor(
        message: string,
        private readonly defaultValue: boolean
    ) {
        this.prefix = `${promptOpenColor("?")} ${message} `
        // Capitalize the default option so the hint matches enquirer.
        this.hint = defaultValue ? "(Y/n)" : "(y/N)"
    }

    /**
     * Pi-tui input dispatch. Handles single-key resolution + Enter
     * default + Escape cancel.
     *
     * @param data Raw bytes from the terminal.
     */
    handleInput(data: string): void {
        if (data === "y" || data === "Y") {
            this.onSelect?.(true, "Yes")
            return
        }
        if (data === "n" || data === "N") {
            this.onSelect?.(false, "No")
            return
        }
        if (data === "\r" || data === "\n") {
            this.onSelect?.(
                this.defaultValue,
                this.defaultValue ? "Yes" : "No"
            )
            return
        }
        if (data === "\x1b") {
            this.onCancel?.()
            return
        }
    }

    /** No cached state. */
    invalidate(): void {}

    /**
     * Render the prompt + hint + cursor on one row.
     *
     * @param width Terminal width in cells.
     */
    render(width: number): string[] {
        const marker = this.focused ? CURSOR_MARKER : ""
        const cursorRendered = `\x1b[7m \x1b[27m`
        const composed = `${this.prefix}${this.hint} ${marker}${cursorRendered}`
        const visualLength = visibleWidth(composed)
        const target = Math.max(visibleWidth(this.prefix) + 1, width)
        const pad = " ".repeat(Math.max(0, target - visualLength))
        return [composed + pad]
    }
}

/**
 * Yes/no confirmation. Resolves to a boolean and persists `"true"` /
 * `"false"` under `component.name`.
 *
 * @param component Confirm component definition.
 * @param ctx Shared execution context.
 */
export async function runConfirm(
    component: ConfirmComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const initial = component.initial ?? true
    const body = new ConfirmKey(message, initial)
    const value = await runInline<boolean>({
        tui: ctx.tui,
        message,
        body,
        bodyOwnsMessage: true,
        wire: (done) => {
            body.onSelect = (v, label) => done(v, label)
            body.onCancel = () => done(undefined, null)
        },
        signal: ctx.signal,
    })
    if (value !== undefined) persist(ctx.variables, component.name, String(value))
}
