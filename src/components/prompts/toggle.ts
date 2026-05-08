/**
 * @file `toggle` prompt — boolean prompt with custom enabled/disabled
 * labels rendered horizontally as `disabled / enabled` with the active
 * label underlined. Arrow Left/Right (and `h`/`l`) switches between
 * states; Enter submits.
 */

import { visibleWidth } from "@earendil-works/pi-tui"
import type { Component, Focusable } from "@earendil-works/pi-tui"
import chalk from "chalk"
import { mutedColor, promptOpenColor } from "../../tui/theme.js"
import type { ToggleComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { persist, renderMessage, runInline } from "./promptUtils.js"

/**
 * Custom focusable that renders both labels side-by-side with the active
 * one underlined. State is a single boolean: `true` = enabled label
 * active, `false` = disabled label active.
 */
class HorizontalToggle implements Component, Focusable {
    /** Set by TUI when focus changes. */
    focused = false

    /** Invoked with the picked boolean and its rendered label. */
    onSelect?: (value: boolean, label: string) => void
    /** Invoked when the user cancels. */
    onCancel?: () => void

    private readonly prefix: string
    private active: boolean

    /**
     * @param message Pre-interpolated message text.
     * @param enabledLabel Label shown when the toggle is enabled.
     * @param disabledLabel Label shown when the toggle is disabled.
     */
    constructor(
        message: string,
        private readonly enabledLabel: string,
        private readonly disabledLabel: string
    ) {
        this.prefix = `${promptOpenColor("?")} ${message} `
        // Default to enabled — matches enquirer's default-on behavior.
        this.active = true
    }

    /**
     * Pi-tui input dispatch. Handles arrow Left/Right (and `h`/`l`)
     * navigation, Enter submission, and Escape cancellation.
     *
     * @param data Raw bytes from the terminal.
     */
    handleInput(data: string): void {
        if (data === "\x1b[D" || data === "\x1bOD" || data === "h") {
            this.active = false
            return
        }
        if (data === "\x1b[C" || data === "\x1bOC" || data === "l") {
            this.active = true
            return
        }
        // Tab also flips — convenient when the toggle is the only widget.
        if (data === "\t") {
            this.active = !this.active
            return
        }
        if (data === "\r" || data === "\n") {
            const label = this.active ? this.enabledLabel : this.disabledLabel
            this.onSelect?.(this.active, label)
            return
        }
        if (data === "\x1b") {
            this.onCancel?.()
        }
    }

    /** No cached state. */
    invalidate(): void {}

    /**
     * Render the prompt + horizontal labels with the active one
     * underlined. No `CURSOR_MARKER` is emitted: the active label's
     * underline already signals state, and pi-tui hides the hardware
     * cursor when no marker appears in the rendered output.
     *
     * @param width Terminal width in cells.
     */
    render(width: number): string[] {
        const left = this.active
            ? mutedColor(this.disabledLabel)
            : chalk.underline(this.disabledLabel)
        const right = this.active
            ? chalk.underline(this.enabledLabel)
            : mutedColor(this.enabledLabel)
        const composed = `${this.prefix}${left} ${mutedColor("/")} ${right}`
        const visualLength = visibleWidth(composed)
        const target = Math.max(visibleWidth(this.prefix) + 1, width)
        const pad = " ".repeat(Math.max(0, target - visualLength))
        return [composed + pad]
    }
}

/**
 * Two-state toggle with author-supplied labels. Resolves to a boolean and
 * persists `"true"` / `"false"`.
 *
 * @param component Toggle component definition.
 * @param ctx Shared execution context.
 */
export async function runToggle(
    component: ToggleComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const body = new HorizontalToggle(
        message,
        component.enabled,
        component.disabled
    )
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
