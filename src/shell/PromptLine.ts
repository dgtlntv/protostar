/**
 * @file Idle shell-prompt component. Renders the colored prompt prefix on
 * the same line as a pi-tui {@link Input}, wires Up/Down arrows to a
 * {@link HistoryStore}, and resolves a promise when the user submits a
 * complete command line.
 */

import { Input, visibleWidth } from "@mariozechner/pi-tui"
import type { Component, Focusable } from "@mariozechner/pi-tui"
import type { HistoryStore } from "./HistoryStore.js"

/** Default xterm-style cursor-up sequence. */
const ARROW_UP = "\x1b[A"
/** Default xterm-style cursor-down sequence. */
const ARROW_DOWN = "\x1b[B"
/** Ctrl+E — pi-tui's `tui.editor.cursorLineEnd` binding. */
const CURSOR_TO_END = "\x05"

/**
 * Composite component that displays the shell prompt and an inline
 * `Input`. The pi-tui `Input` ships with a hardcoded `"> "` prefix; this
 * wrapper renders the input at a reduced width and rewrites that prefix
 * to the colored shell prompt — keeping the input cursor and editing
 * logic intact while presenting `user@ubuntu:~$ ` (or whatever the host
 * configured) on the same line.
 */
export class PromptLine implements Component, Focusable {
    /** Set by TUI when focus changes. */
    focused = false

    /** Invoked with the submitted line (which may be multi-line). */
    onSubmit?: (value: string) => void

    /** Pre-rendered prompt (ANSI sequences allowed). */
    private prompt: string
    private promptWidth: number
    private input = new Input()
    private history: HistoryStore

    /**
     * @param prompt Pre-rendered prompt string, possibly containing ANSI
     *   color escapes. Visible width is measured for column accounting.
     * @param history Shared history store used for Up/Down recall.
     */
    constructor(prompt: string, history: HistoryStore) {
        this.prompt = prompt
        this.promptWidth = visibleWidth(prompt)
        this.history = history

        this.input.onSubmit = (value) => {
            if (this.onSubmit) this.onSubmit(value)
        }
    }

    /** Set the editable buffer. Used to seed history recalls. */
    setValue(value: string): void {
        this.input.setValue(value)
    }

    /** @returns The current editable buffer contents. */
    getValue(): string {
        return this.input.getValue()
    }

    /**
     * Read the cursor offset within the editable buffer.
     *
     * Used by the e2e helper module to satisfy the cursor-position contract
     * the Phase 1 specs rely on. The pi-tui `Input` keeps `cursor` as a
     * non-private class field, so this getter surfaces it without patching
     * upstream.
     *
     * @returns Zero-based cursor offset into `getValue()`.
     */
    getCursor(): number {
        return (this.input as unknown as { cursor: number }).cursor
    }

    /** Reset the buffer after a submit so the next line starts blank. */
    reset(): void {
        this.input.setValue("")
    }

    invalidate(): void {
        this.input.invalidate()
    }

    handleInput(data: string): void {
        if (data === ARROW_UP) {
            const prev = this.history.getPrevious()
            if (prev !== undefined) {
                this.input.setValue(prev)
                // pi-tui `Input.setValue` clamps the cursor but does not
                // advance it to the end of the new buffer; sending Ctrl+E
                // mirrors the bash-style "land at the end of the recalled
                // line" expectation.
                this.input.handleInput(CURSOR_TO_END)
            }
            return
        }
        if (data === ARROW_DOWN) {
            const next = this.history.getNext()
            this.input.setValue(next ?? "")
            this.input.handleInput(CURSOR_TO_END)
            return
        }
        this.input.focused = this.focused
        this.input.handleInput(data)
    }

    render(width: number): string[] {
        // Reserve real-estate for our prompt. Input's own prefix is "> "
        // (2 visible cells); we render it at `width - promptWidth + 2`
        // so that after we substitute its prefix with our prompt the
        // total line width matches `width` exactly.
        this.input.focused = this.focused
        const innerWidth = Math.max(2, width - this.promptWidth + 2)
        const lines = this.input.render(innerWidth)
        if (lines.length === 0) return [this.prompt]
        const [first, ...rest] = lines
        const replaced = first.startsWith("> ")
            ? this.prompt + first.slice(2)
            : this.prompt + first
        return [replaced, ...rest]
    }
}
