/**
 * @file Single-row inline prompt. Renders the leading `?` glyph, the
 * message, and the live editable buffer on one line so prompts read
 * naturally as `? Message: ▮`. Wraps the same editing primitives the
 * shell `PromptLine` uses (grapheme-aware cursor moves, word-wise nav,
 * char/word delete, paste handling) and adds optional masking for
 * password-style prompts.
 */

import { CURSOR_MARKER, getKeybindings, visibleWidth } from "@mariozechner/pi-tui"
import type { Component, Focusable } from "@mariozechner/pi-tui"
import { promptOpenColor } from "../../tui/theme.js"

/** Bracketed paste start marker. */
const PASTE_START = "\x1b[200~"
/** Bracketed paste end marker. */
const PASTE_END = "\x1b[201~"
/** Length of {@link PASTE_END}. */
const PASTE_END_LEN = PASTE_END.length
/** Ctrl+C — cancels the prompt. */
const CTRL_C = "\x03"

/** Single grapheme segmenter shared across instances. */
const segmenter = new Intl.Segmenter()

/**
 * How the buffer is rendered. `plain` echoes the value verbatim; `mask`
 * substitutes a glyph per code unit; `hidden` shows nothing.
 */
export type InlineMask =
    | { kind: "plain" }
    | { kind: "mask"; char: string }
    | { kind: "hidden" }

/** Constructor options for {@link InlinePrompt}. */
export interface InlinePromptOptions {
    /** Pre-interpolated message (renders as `? <message> `). */
    message: string
    /** Seed value placed in the buffer. Defaults to empty. */
    initial?: string
    /** Render mode for the value. Defaults to `plain`. */
    mask?: InlineMask
    /** Predicate that filters keystrokes before insertion. */
    accept?: (data: string) => boolean
}

/**
 * Predicate matching the whitespace class pi-tui's word-wise nav uses.
 *
 * @param ch Single grapheme to test.
 */
function isWhitespace(ch: string): boolean {
    return ch === " " || ch === "\t"
}

/** ASCII punctuation set bounding word-wise navigation. */
const PUNCTUATION = new Set(
    ".,;:!?'\"()[]{}<>/\\|`~@#$%^&*-_=+".split("")
)

/**
 * Predicate matching the punctuation class pi-tui's word-wise nav uses.
 *
 * @param ch Single grapheme to test.
 */
function isPunctuation(ch: string): boolean {
    return ch.length === 1 && PUNCTUATION.has(ch)
}

/**
 * Single-row inline prompt component used by `input`, `number`,
 * `password`, `invisible`, and `list`. Owns the editable buffer + cursor
 * and emits `onSubmit(value)` when the user presses Enter or
 * `onCancel()` when they press Escape or Ctrl+C.
 */
export class InlinePrompt implements Component, Focusable {
    /** Set by TUI when focus changes. */
    focused = false

    /** Invoked with the buffer contents on Enter. */
    onSubmit?: (value: string) => void
    /** Invoked when the user cancels (Escape / Ctrl+C). */
    onCancel?: () => void

    /** Pre-rendered prompt prefix `? <message> ` (ANSI sequences allowed). */
    private readonly prefix: string
    /** Visible width of {@link prefix}. */
    private readonly prefixWidth: number
    /** Render mode for the buffer. */
    private readonly mask: InlineMask
    /** Optional keystroke predicate. */
    private readonly accept?: (data: string) => boolean

    private value: string
    private cursor: number

    private pasteBuffer = ""
    private isInPaste = false

    /**
     * @param opts See {@link InlinePromptOptions}.
     */
    constructor(opts: InlinePromptOptions) {
        const prefix = `${promptOpenColor("?")} ${opts.message} `
        this.prefix = prefix
        this.prefixWidth = visibleWidth(prefix)
        this.mask = opts.mask ?? { kind: "plain" }
        this.accept = opts.accept
        this.value = opts.initial ?? ""
        this.cursor = this.value.length
    }

    /** @returns Current buffer contents. */
    getValue(): string {
        return this.value
    }

    /**
     * Replace the buffer wholesale and place the cursor at the end.
     *
     * @param value New buffer contents.
     */
    setValue(value: string): void {
        this.value = value
        this.cursor = value.length
    }

    /** @returns Zero-based cursor offset. */
    getCursor(): number {
        return this.cursor
    }

    /** Required by `Component`; no cached state to invalidate. */
    invalidate(): void {}

    /**
     * Pi-tui input dispatch. Handles bracketed paste, Ctrl+C, Enter,
     * cursor movement, deletion, and inserting accepted printable text.
     *
     * @param data Raw bytes from the terminal.
     */
    handleInput(data: string): void {
        if (data.includes(PASTE_START)) {
            this.isInPaste = true
            this.pasteBuffer = ""
            data = data.replace(PASTE_START, "")
        }
        if (this.isInPaste) {
            this.pasteBuffer += data
            const endIndex = this.pasteBuffer.indexOf(PASTE_END)
            if (endIndex === -1) return
            const pasted = this.pasteBuffer.slice(0, endIndex)
            const remainder = this.pasteBuffer.slice(endIndex + PASTE_END_LEN)
            this.isInPaste = false
            this.pasteBuffer = ""
            this.handlePaste(pasted)
            if (remainder) this.handleInput(remainder)
            return
        }

        if (data === CTRL_C) {
            this.onCancel?.()
            return
        }

        const kb = getKeybindings()

        if (kb.matches(data, "tui.select.cancel")) {
            this.onCancel?.()
            return
        }

        if (kb.matches(data, "tui.input.submit") || data === "\n") {
            this.onSubmit?.(this.value)
            return
        }

        if (kb.matches(data, "tui.editor.cursorWordLeft")) {
            this.moveWordLeft()
            return
        }
        if (kb.matches(data, "tui.editor.cursorWordRight")) {
            this.moveWordRight()
            return
        }
        if (kb.matches(data, "tui.editor.cursorLeft")) {
            this.moveCursorLeft()
            return
        }
        if (kb.matches(data, "tui.editor.cursorRight")) {
            this.moveCursorRight()
            return
        }
        if (kb.matches(data, "tui.editor.cursorLineStart")) {
            this.cursor = 0
            return
        }
        if (kb.matches(data, "tui.editor.cursorLineEnd")) {
            this.cursor = this.value.length
            return
        }
        // Word-level deletion runs first so the shared byte `\x08`
        // (Ctrl+Backspace in browser xterm) routes to word delete.
        if (kb.matches(data, "tui.editor.deleteWordBackward")) {
            this.deleteWordBackward()
            return
        }
        if (kb.matches(data, "tui.editor.deleteWordForward")) {
            this.deleteWordForward()
            return
        }
        if (kb.matches(data, "tui.editor.deleteCharBackward")) {
            this.deleteBackward()
            return
        }
        if (kb.matches(data, "tui.editor.deleteCharForward")) {
            this.deleteForward()
            return
        }

        const hasControlChars = [...data].some((ch) => {
            const code = ch.charCodeAt(0)
            return code < 32 || code === 0x7f || (code >= 0x80 && code <= 0x9f)
        })
        if (hasControlChars) return

        if (this.accept && ![...data].every((ch) => this.accept!(ch))) return

        this.value =
            this.value.slice(0, this.cursor) +
            data +
            this.value.slice(this.cursor)
        this.cursor += data.length
    }

    /**
     * Handle a paste body — strip newlines (single-line component) and
     * filter through `accept` if configured. The pasted content is
     * inserted at the cursor.
     *
     * @param raw The inner paste content.
     */
    private handlePaste(raw: string): void {
        let text = raw.replace(/[\r\n]+/g, "")
        if (this.accept) text = [...text].filter(this.accept).join("")
        // Reject embedded control bytes per the keystroke policy.
        text = [...text]
            .filter((ch) => {
                const code = ch.charCodeAt(0)
                return !(
                    code < 32 ||
                    code === 0x7f ||
                    (code >= 0x80 && code <= 0x9f)
                )
            })
            .join("")
        if (!text) return
        this.value =
            this.value.slice(0, this.cursor) + text + this.value.slice(this.cursor)
        this.cursor += text.length
    }

    private moveCursorLeft(): void {
        if (this.cursor === 0) return
        const before = this.value.slice(0, this.cursor)
        const graphemes = [...segmenter.segment(before)]
        const last = graphemes[graphemes.length - 1]
        this.cursor -= last ? last.segment.length : 1
    }

    private moveCursorRight(): void {
        if (this.cursor >= this.value.length) return
        const after = this.value.slice(this.cursor)
        const first = segmenter.segment(after)[Symbol.iterator]().next()
        this.cursor += first.value ? first.value.segment.length : 1
    }

    private moveWordLeft(): void {
        if (this.cursor === 0) return
        const before = this.value.slice(0, this.cursor)
        const graphemes = [...segmenter.segment(before)]
        while (
            graphemes.length > 0 &&
            isWhitespace(graphemes[graphemes.length - 1].segment)
        ) {
            this.cursor -= graphemes.pop()!.segment.length
        }
        if (graphemes.length === 0) return
        const last = graphemes[graphemes.length - 1].segment
        if (isPunctuation(last)) {
            while (
                graphemes.length > 0 &&
                isPunctuation(graphemes[graphemes.length - 1].segment)
            ) {
                this.cursor -= graphemes.pop()!.segment.length
            }
        } else {
            while (
                graphemes.length > 0 &&
                !isWhitespace(graphemes[graphemes.length - 1].segment) &&
                !isPunctuation(graphemes[graphemes.length - 1].segment)
            ) {
                this.cursor -= graphemes.pop()!.segment.length
            }
        }
    }

    private moveWordRight(): void {
        if (this.cursor >= this.value.length) return
        const after = this.value.slice(this.cursor)
        const it = segmenter.segment(after)[Symbol.iterator]()
        let next = it.next()
        while (!next.done && isWhitespace(next.value.segment)) {
            this.cursor += next.value.segment.length
            next = it.next()
        }
        if (next.done) return
        const first = next.value.segment
        if (isPunctuation(first)) {
            while (!next.done && isPunctuation(next.value.segment)) {
                this.cursor += next.value.segment.length
                next = it.next()
            }
        } else {
            while (
                !next.done &&
                !isWhitespace(next.value.segment) &&
                !isPunctuation(next.value.segment)
            ) {
                this.cursor += next.value.segment.length
                next = it.next()
            }
        }
    }

    private deleteBackward(): void {
        if (this.cursor === 0) return
        const before = this.value.slice(0, this.cursor)
        const graphemes = [...segmenter.segment(before)]
        const last = graphemes[graphemes.length - 1]
        const len = last ? last.segment.length : 1
        this.value =
            this.value.slice(0, this.cursor - len) + this.value.slice(this.cursor)
        this.cursor -= len
    }

    private deleteForward(): void {
        if (this.cursor >= this.value.length) return
        const after = this.value.slice(this.cursor)
        const first = segmenter.segment(after)[Symbol.iterator]().next()
        const len = first.value ? first.value.segment.length : 1
        this.value =
            this.value.slice(0, this.cursor) +
            this.value.slice(this.cursor + len)
    }

    private deleteWordBackward(): void {
        if (this.cursor === 0) return
        const oldCursor = this.cursor
        this.moveWordLeft()
        const start = this.cursor
        this.value = this.value.slice(0, start) + this.value.slice(oldCursor)
    }

    private deleteWordForward(): void {
        if (this.cursor >= this.value.length) return
        const oldCursor = this.cursor
        this.moveWordRight()
        const end = this.cursor
        this.value = this.value.slice(0, oldCursor) + this.value.slice(end)
        this.cursor = oldCursor
    }

    /**
     * Apply the configured mask to a buffer slice.
     *
     * @param text Raw buffer slice.
     */
    private maskText(text: string): string {
        switch (this.mask.kind) {
            case "plain":
                return text
            case "mask":
                return this.mask.char.repeat([...text].length)
            case "hidden":
                return ""
        }
    }

    /**
     * Render the prompt prefix + (optionally masked) buffer + cursor on a
     * single row. Wraps over xterm.js's natural line wrap when the row
     * exceeds the terminal width.
     *
     * @param width Terminal width in cells.
     */
    render(width: number): string[] {
        const displayed = this.maskText(this.value)
        // For mask/hidden modes, the cursor never moves into hidden text,
        // so we anchor it at the end of the visible buffer.
        const isMasked = this.mask.kind !== "plain"
        const visibleCursor = isMasked ? displayed.length : this.cursor
        const before = displayed.slice(0, visibleCursor)
        const afterAll = displayed.slice(visibleCursor)
        const afterFirst = afterAll[Symbol.iterator]().next()
        const cursorChar = afterFirst.value ?? " "
        const after = afterAll.slice(cursorChar.length)
        const marker = this.focused ? CURSOR_MARKER : ""
        const cursorRendered = `\x1b[7m${cursorChar}\x1b[27m`
        const composed = this.prefix + before + marker + cursorRendered + after
        const visualLength = visibleWidth(composed)
        const target = Math.max(this.prefixWidth + 1, width)
        const pad = " ".repeat(Math.max(0, target - visualLength))
        return [composed + pad]
    }
}
