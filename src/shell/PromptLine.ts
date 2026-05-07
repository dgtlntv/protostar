/**
 * @file Idle shell-prompt component. Owns the complete editing buffer
 * (newlines included), renders the colored prompt prefix on the first row
 * and continuation rows flush at column 0, wires Up/Down to a
 * {@link HistoryStore}, dispatches a complete command line via
 * `onComplete`, and signals Ctrl+C via `onCancel`.
 *
 * The buffer is a single string with embedded `\n`s and a single integer
 * cursor offset, so cursor moves, Backspace, and Home/End all operate
 * against the whole multi-line input — there is no auxiliary
 * already-submitted-line buffer above the editable region. Enter checks
 * {@link isIncomplete} to decide between inserting a literal `\n` and
 * firing `onComplete`.
 */

import { CURSOR_MARKER, getKeybindings, visibleWidth } from "@mariozechner/pi-tui"
import type { Component, Focusable } from "@mariozechner/pi-tui"
import type { HistoryStore } from "./HistoryStore.js"
import { isIncomplete } from "./isIncomplete.js"

/** Bracketed paste start marker emitted by xterm in paste mode. */
const PASTE_START = "\x1b[200~"
/** Bracketed paste end marker. */
const PASTE_END = "\x1b[201~"
/** Length of {@link PASTE_END}; cached for substring math. */
const PASTE_END_LEN = PASTE_END.length
/** Ctrl+C — cancels the current line without pushing to history. */
const CTRL_C = "\x03"

/** Single grapheme-aware segmenter, shared across instances. */
const segmenter = new Intl.Segmenter()

/**
 * Predicate matching the whitespace class that pi-tui's word-wise nav uses.
 *
 * @param ch Single grapheme to test.
 * @returns `true` if `ch` is space, tab, newline, or carriage return.
 */
function isWhitespace(ch: string): boolean {
    return ch === " " || ch === "\t" || ch === "\n" || ch === "\r"
}

/** ASCII punctuation set that bounds word-wise navigation. */
const PUNCTUATION = new Set(
    ".,;:!?'\"()[]{}<>/\\|`~@#$%^&*-_=+".split("")
)

/**
 * Predicate matching the punctuation class that pi-tui's word-wise nav uses.
 *
 * @param ch Single grapheme to test.
 * @returns `true` if `ch` is one of the recognized punctuation characters.
 */
function isPunctuation(ch: string): boolean {
    return ch.length === 1 && PUNCTUATION.has(ch)
}

/**
 * Slice `line` to a `width`-wide window centered on `cursorCol` (the
 * grapheme-aware cursor column within `line`). Used to build a horizontal
 * scroll view of the focused logical line so a long line stays visible
 * around the cursor.
 *
 * @param line Logical line text.
 * @param cursorCol Cursor's column position within `line` (visible cells).
 * @param width Target window width in visible cells.
 * @returns The visible window text and the cursor's column within it.
 */
function windowAroundCursor(
    line: string,
    cursorCol: number,
    width: number
): { text: string; cursorOffset: number; startCol: number } {
    const totalWidth = visibleWidth(line)
    if (totalWidth <= width) {
        return { text: line, cursorOffset: cursorCol, startCol: 0 }
    }
    // Reserve one column for the cursor when at end-of-line.
    const scrollWidth = cursorCol >= totalWidth ? width - 1 : width
    if (scrollWidth <= 0) {
        return { text: "", cursorOffset: 0, startCol: 0 }
    }
    const half = Math.floor(scrollWidth / 2)
    let startCol: number
    if (cursorCol < half) {
        startCol = 0
    } else if (cursorCol > totalWidth - half) {
        startCol = Math.max(0, totalWidth - scrollWidth)
    } else {
        startCol = Math.max(0, cursorCol - half)
    }
    const text = sliceByVisibleColumn(line, startCol, scrollWidth)
    const cursorOffset = cursorCol - startCol
    return { text, cursorOffset, startCol }
}

/**
 * Grapheme-aware slice by visible-column range. Walks `line`'s graphemes,
 * accumulating visible width, and returns the substring that fits inside
 * the `[startCol, startCol + maxWidth)` window. Replaces wide-char-aware
 * `String.slice` for terminal rendering.
 *
 * @param line Source text.
 * @param startCol Starting column (visible cells).
 * @param maxWidth Maximum visible width to include.
 * @returns The sliced substring.
 */
function sliceByVisibleColumn(line: string, startCol: number, maxWidth: number): string {
    let col = 0
    let out = ""
    for (const seg of segmenter.segment(line)) {
        const w = visibleWidth(seg.segment)
        if (col + w <= startCol) {
            col += w
            continue
        }
        if (col >= startCol + maxWidth) break
        if (col < startCol) {
            // Grapheme straddles the start; skip it for clean alignment.
            col += w
            continue
        }
        if (col + w > startCol + maxWidth) break
        out += seg.segment
        col += w
    }
    return out
}

/**
 * Walk `value` and return per-logical-line spans. Each span records the
 * line text and the starting offset of that line in `value`. A trailing
 * `\n` produces a final empty span, which `render` uses to draw an empty
 * continuation row when the user just pressed Enter on an incomplete line.
 *
 * @param value Buffer text.
 * @returns Logical-line spans, one per `\n`-separated chunk.
 */
function splitLines(value: string): Array<{ text: string; start: number }> {
    const lines: Array<{ text: string; start: number }> = []
    let start = 0
    for (let i = 0; i <= value.length; i++) {
        if (i === value.length || value[i] === "\n") {
            lines.push({ text: value.slice(start, i), start })
            start = i + 1
        }
    }
    return lines
}

/**
 * Convert a buffer offset into `(lineIndex, columnInLine)`. The column is a
 * grapheme-aware visible column count, suitable for cursor placement.
 *
 * @param value Buffer text.
 * @param offset Byte offset into `value`.
 * @returns Logical-line index and visible column within that line.
 */
function offsetToLineCol(value: string, offset: number): { line: number; col: number } {
    let line = 0
    let lineStart = 0
    for (let i = 0; i < offset; i++) {
        if (value[i] === "\n") {
            line++
            lineStart = i + 1
        }
    }
    const col = visibleWidth(value.slice(lineStart, offset))
    return { line, col }
}

/**
 * Multi-line shell prompt. Replaces the previous single-line wrapper over
 * pi-tui's `Input` so cursor moves, Backspace, and Home/End operate against
 * the whole continuation buffer.
 */
export class PromptLine implements Component, Focusable {
    /** Set by TUI when focus changes. Component emits `CURSOR_MARKER` when true. */
    focused = false

    /**
     * Fired with one or more shell-complete lines. Single-line submits via
     * Enter pass `[value]`; a multi-line paste that contains complete lines
     * passes them in order. When this fires, `value` already holds the
     * paste tail (or empty for a plain Enter); the embedder is expected to
     * unmount the prompt after handling the submission.
     */
    onComplete?: (lines: string[]) => void

    /**
     * Fired on Ctrl+C. Embedder should flush a `^C` marker to scrollback,
     * rewind history, unmount, and remount a fresh prompt. The prompt does
     * not clear its own state — the embedder controls remounting.
     */
    onCancel?: () => void

    /** Pre-rendered prompt prefix (ANSI sequences allowed). */
    private readonly prompt: string
    /** Visible width of {@link prompt}. */
    private readonly promptWidth: number
    /** Backing history store; Up/Down arrow recall reads this. */
    private readonly history: HistoryStore

    /** The complete editable buffer; may contain embedded `\n`s. */
    private value = ""
    /** Zero-based byte offset into {@link value}. */
    private cursor = 0

    /** Bracketed-paste accumulator (the `\x1b[200~ ... \x1b[201~` body). */
    private pasteBuffer = ""
    /** Whether we are currently inside a bracketed paste sequence. */
    private isInPaste = false

    /**
     * @param prompt Pre-rendered colored prompt prefix.
     * @param history Shared history store used for Up/Down recall.
     */
    constructor(prompt: string, history: HistoryStore) {
        this.prompt = prompt
        this.promptWidth = visibleWidth(prompt)
        this.history = history
    }

    /**
     * Replace the buffer wholesale and place the cursor at the end. Used by
     * the embedder to seed a paste tail into the next prompt and by
     * `onHistoryRecall` to install a recalled command.
     *
     * @param value New buffer contents.
     */
    setValue(value: string): void {
        this.value = value
        this.cursor = value.length
    }

    /** @returns The current editable buffer contents. */
    getValue(): string {
        return this.value
    }

    /** @returns Zero-based cursor offset into `getValue()`. */
    getCursor(): number {
        return this.cursor
    }

    /** Cached state has nothing to invalidate; satisfies the `Component` contract. */
    invalidate(): void {}

    /**
     * Dispatch keyboard input. Handles bracketed paste accumulation,
     * Ctrl+C, history navigation, shell-aware Enter, and forwards
     * everything else to grapheme-aware editing primitives.
     *
     * @param data Input chunk from the terminal.
     */
    handleInput(data: string): void {
        // Bracketed paste handling — accumulate until end marker, then run
        // through the paste path that splits per `\n` and dispatches each
        // shell-complete chunk.
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

        // Raw multi-line paste: xterm.js does not wrap paste events in
        // `\x1b[200~ ... \x1b[201~` unless the application enables
        // bracketed paste mode (CSI ?2004h), so a paste with embedded
        // newlines arrives as a plain chunk like `"logout\nlogout\n"`.
        // Anything longer than a single byte that contains a `\n` or `\r`
        // is treated as a paste body so we can normalize line endings and
        // dispatch each shell-complete line. Single-keystroke Enter (`\r`
        // or `\n`) and multi-byte escape sequences without embedded line
        // breaks (e.g. `\x1b[D`) are unaffected.
        if (data.length > 1 && (data.includes("\n") || data.includes("\r"))) {
            this.handlePaste(data)
            return
        }

        const kb = getKeybindings()

        // Up/Down — history navigation (always, even mid-multi-line edit).
        if (kb.matches(data, "tui.editor.cursorUp")) {
            const prev = this.history.getPrevious()
            if (prev !== undefined) this.setValue(prev)
            return
        }
        if (kb.matches(data, "tui.editor.cursorDown")) {
            const next = this.history.getNext()
            this.setValue(next ?? "")
            return
        }

        // Enter — shell-aware: continuation when the buffer is incomplete,
        // submit otherwise. Both `\n` (legacy line endings) and the
        // configured submit binding are accepted.
        if (kb.matches(data, "tui.input.submit") || data === "\n") {
            this.handleEnter()
            return
        }

        // Cursor movement.
        if (kb.matches(data, "tui.editor.cursorLeft")) {
            this.moveCursorLeft()
            return
        }
        if (kb.matches(data, "tui.editor.cursorRight")) {
            this.moveCursorRight()
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
        // Home / End: whole-buffer bounds (pinned semantics — Home does not
        // stop at the current visual line's start).
        if (kb.matches(data, "tui.editor.cursorLineStart")) {
            this.cursor = 0
            return
        }
        if (kb.matches(data, "tui.editor.cursorLineEnd")) {
            this.cursor = this.value.length
            return
        }

        // Deletion.
        if (kb.matches(data, "tui.editor.deleteCharBackward")) {
            this.deleteBackward()
            return
        }
        if (kb.matches(data, "tui.editor.deleteCharForward")) {
            this.deleteForward()
            return
        }
        if (kb.matches(data, "tui.editor.deleteWordBackward")) {
            this.deleteWordBackward()
            return
        }
        if (kb.matches(data, "tui.editor.deleteWordForward")) {
            this.deleteWordForward()
            return
        }

        // Reject control characters (C0, DEL, C1) — fixes the legacy ESC
        // insertion bug by construction. Mirrors the policy in pi-tui's
        // `Input.handleInput`.
        const hasControlChars = [...data].some((ch) => {
            const code = ch.charCodeAt(0)
            return code < 32 || code === 0x7f || (code >= 0x80 && code <= 0x9f)
        })
        if (!hasControlChars) {
            this.insertText(data)
        }
    }

    /**
     * Insert raw text at the cursor (no normalization, no shell-completion
     * checks). Used for ordinary keystrokes and during paste segment
     * insertion.
     *
     * @param text Text to insert.
     */
    private insertText(text: string): void {
        this.value = this.value.slice(0, this.cursor) + text + this.value.slice(this.cursor)
        this.cursor += text.length
    }

    /**
     * Handle Enter. Inserts a literal `\n` at the cursor when the buffer is
     * shell-incomplete; otherwise fires `onComplete([value])` with the
     * completed buffer and clears the local state so a fresh prompt starts
     * empty.
     */
    private handleEnter(): void {
        if (isIncomplete(this.value)) {
            this.insertText("\n")
            return
        }
        const submitted = this.value
        this.value = ""
        this.cursor = 0
        this.onComplete?.([submitted])
    }

    /**
     * Process a bracketed-paste body. Normalizes line endings, splits on
     * `\n`, and walks each segment: if pasting a segment turns the buffer
     * shell-complete, that buffer is collected as a submitted line and the
     * editing state resets; if it remains incomplete, a literal `\n` is
     * inserted to keep the continuation alive. The trailing post-last-`\n`
     * segment (the "tail") is left in the buffer for further editing.
     *
     * Fires `onComplete(submitted)` once at the end if any segment
     * dispatched. The remainder is observable via `getValue()`.
     *
     * @param raw The inner paste content (between `\x1b[200~` and `\x1b[201~`).
     */
    private handlePaste(raw: string): void {
        const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
        if (!normalized.includes("\n")) {
            // Pure inline paste — same effect as typing the characters.
            // Reject any embedded control bytes per the keystroke policy.
            const filtered = [...normalized]
                .filter((ch) => {
                    const code = ch.charCodeAt(0)
                    return !(code < 32 || code === 0x7f || (code >= 0x80 && code <= 0x9f))
                })
                .join("")
            if (filtered) this.insertText(filtered)
            return
        }
        const parts = normalized.split("\n")
        const submitted: string[] = []
        for (let i = 0; i < parts.length - 1; i++) {
            this.insertText(parts[i])
            if (isIncomplete(this.value)) {
                this.insertText("\n")
            } else {
                submitted.push(this.value)
                this.value = ""
                this.cursor = 0
            }
        }
        // Trailing tail — becomes the live remainder.
        const tail = parts[parts.length - 1]
        if (tail) this.insertText(tail)

        if (submitted.length > 0) {
            this.onComplete?.(submitted)
        }
    }

    /**
     * Step the cursor one grapheme to the left. Walks backward across `\n`
     * boundaries — the `\n` is a normal character in the buffer.
     */
    private moveCursorLeft(): void {
        if (this.cursor === 0) return
        const before = this.value.slice(0, this.cursor)
        const graphemes = [...segmenter.segment(before)]
        const last = graphemes[graphemes.length - 1]
        this.cursor -= last ? last.segment.length : 1
    }

    /** Step the cursor one grapheme to the right; walks across `\n` boundaries. */
    private moveCursorRight(): void {
        if (this.cursor >= this.value.length) return
        const after = this.value.slice(this.cursor)
        const first = segmenter.segment(after)[Symbol.iterator]().next()
        this.cursor += first.value ? first.value.segment.length : 1
    }

    /**
     * Step the cursor backward by one word. Skips trailing whitespace, then
     * a punctuation run, otherwise a word run. Mirrors pi-tui's
     * `Input.moveWordBackwards`.
     */
    private moveWordLeft(): void {
        if (this.cursor === 0) return
        const before = this.value.slice(0, this.cursor)
        const graphemes = [...segmenter.segment(before)]
        // Skip trailing whitespace.
        while (graphemes.length > 0 && isWhitespace(graphemes[graphemes.length - 1].segment)) {
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

    /** Step the cursor forward by one word. Mirrors `Input.moveWordForwards`. */
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

    /**
     * Delete the grapheme before the cursor. At the start of a continuation
     * line (column 0 of line N>0), deletes the preceding `\n` and joins the
     * lines.
     */
    private deleteBackward(): void {
        if (this.cursor === 0) return
        const before = this.value.slice(0, this.cursor)
        const graphemes = [...segmenter.segment(before)]
        const last = graphemes[graphemes.length - 1]
        const len = last ? last.segment.length : 1
        this.value = this.value.slice(0, this.cursor - len) + this.value.slice(this.cursor)
        this.cursor -= len
    }

    /** Delete the grapheme at the cursor; joins lines when at end of a line. */
    private deleteForward(): void {
        if (this.cursor >= this.value.length) return
        const after = this.value.slice(this.cursor)
        const first = segmenter.segment(after)[Symbol.iterator]().next()
        const len = first.value ? first.value.segment.length : 1
        this.value = this.value.slice(0, this.cursor) + this.value.slice(this.cursor + len)
    }

    /** Delete back to the previous word boundary. */
    private deleteWordBackward(): void {
        if (this.cursor === 0) return
        const oldCursor = this.cursor
        this.moveWordLeft()
        const start = this.cursor
        this.value = this.value.slice(0, start) + this.value.slice(oldCursor)
    }

    /** Delete forward to the next word boundary. */
    private deleteWordForward(): void {
        if (this.cursor >= this.value.length) return
        const oldCursor = this.cursor
        this.moveWordRight()
        const end = this.cursor
        this.value = this.value.slice(0, oldCursor) + this.value.slice(end)
        this.cursor = oldCursor
    }

    /**
     * Render the prompt + multi-line buffer. The first logical line gets
     * the colored prompt prefix; subsequent lines render flush at column 0.
     * The logical line containing the cursor uses a horizontal-scroll
     * window so the cursor stays visible; other lines are sliced from
     * column 0. The cursor character is drawn with reverse video and
     * preceded by `CURSOR_MARKER` when focused so the TUI can position the
     * hardware cursor for IME support.
     *
     * @param width Terminal width in cells.
     * @returns One rendered line per logical line (newline-separated row).
     */
    render(width: number): string[] {
        const lines = splitLines(this.value)
        const cursorPos = offsetToLineCol(this.value, this.cursor)
        const result: string[] = []
        for (let i = 0; i < lines.length; i++) {
            const isFirst = i === 0
            const isCursorLine = i === cursorPos.line
            const prefix = isFirst ? this.prompt : ""
            const prefixWidth = isFirst ? this.promptWidth : 0
            const available = Math.max(2, width - prefixWidth)
            const text = lines[i].text

            if (!isCursorLine) {
                // Static line — slice from col 0, no cursor decoration.
                const visible = sliceByVisibleColumn(text, 0, available)
                const pad = " ".repeat(Math.max(0, available - visibleWidth(visible)))
                result.push(prefix + visible + pad)
                continue
            }

            // Cursor line — windowed slice that follows the cursor.
            const win = windowAroundCursor(text, cursorPos.col, available)
            const localCursorCol = win.cursorOffset
            // Map the visible cursor column back to a byte offset within
            // the windowed text so we can split it correctly.
            const splitOffset = sliceByVisibleColumn(win.text, 0, localCursorCol).length
            const beforeCursor = win.text.slice(0, splitOffset)
            const afterAll = win.text.slice(splitOffset)
            const afterFirst = afterAll[Symbol.iterator]().next()
            const cursorChar = afterFirst.value ?? " "
            const afterCursor = afterAll.slice(cursorChar.length)
            const marker = this.focused ? CURSOR_MARKER : ""
            const cursorRendered = `\x1b[7m${cursorChar}\x1b[27m`
            const composed = prefix + beforeCursor + marker + cursorRendered + afterCursor
            const visualLength = visibleWidth(composed) - prefixWidth
            const pad = " ".repeat(Math.max(0, available - visualLength))
            result.push(composed + pad)
        }
        return result
    }
}
