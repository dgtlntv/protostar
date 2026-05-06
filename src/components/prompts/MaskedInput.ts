/**
 * @file Minimal single-line input component that masks (or hides) what the
 * user types. Used by `password` and `invisible` prompts where pi-tui's
 * `Input` would echo the value verbatim.
 *
 * Intentionally small: insert printable characters, backspace, submit on
 * Enter, cancel on Escape. The richer editing affordances of pi-tui's
 * `Input` (kill ring, undo, word nav, bracketed paste) aren't useful for a
 * masked field and are skipped to keep the surface small.
 */

import { CURSOR_MARKER } from "@mariozechner/pi-tui"
import type { Component, Focusable } from "@mariozechner/pi-tui"

/** Character used to render each typed character; empty string hides input. */
export type MaskMode = { kind: "mask"; char: string } | { kind: "hidden" }

/**
 * Tiny masked single-line input. Collects characters internally and only
 * renders the mask glyph (or nothing) so the typed value never reaches
 * the buffer.
 */
export class MaskedInput implements Component, Focusable {
    private value = ""
    /** Set by TUI when focus changes. */
    focused = false
    /** Invoked with the typed value on Enter. */
    onSubmit?: (value: string) => void
    /** Invoked when the user presses Escape or Ctrl+C. */
    onEscape?: () => void

    /** @param mode Whether to render a mask glyph per character or nothing at all. */
    constructor(private readonly mode: MaskMode) {}

    /** @returns The currently buffered value. */
    getValue(): string {
        return this.value
    }

    /**
     * Pi-tui input dispatch. Handles Enter, Escape/Ctrl+C, Backspace, and
     * any printable character; everything else is ignored.
     *
     * @param data Raw bytes from the terminal.
     */
    handleInput(data: string): void {
        if (data === "\r" || data === "\n") {
            this.onSubmit?.(this.value)
            return
        }
        if (data === "\x1b" || data === "\x03") {
            this.onEscape?.()
            return
        }
        if (data === "\x7f" || data === "\b") {
            this.value = this.value.slice(0, -1)
            return
        }
        const hasControl = [...data].some((ch) => {
            const code = ch.charCodeAt(0)
            return code < 32 || code === 0x7f
        })
        if (!hasControl) this.value += data
    }

    /** No cached state. */
    invalidate(): void {}

    /**
     * Render the prompt line with masked characters.
     *
     * @param _width Ignored — masked input does not horizontally scroll.
     * @returns Single-element line array.
     */
    render(_width: number): string[] {
        const masked =
            this.mode.kind === "hidden"
                ? ""
                : this.mode.char.repeat(this.value.length)
        const cursor = this.focused ? CURSOR_MARKER + "\x1b[7m \x1b[27m" : " "
        return [`> ${masked}${cursor}`]
    }
}
