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
 * Match a single ANSI escape sequence at the start of `s`. Recognises CSI
 * (`\x1b[...letter`), OSC (`\x1b]...\x07`), and the common two-byte ESC
 * sequences. ANSI sequences have zero visible width and pass through the
 * wrap logic untouched.
 *
 * @param s String whose first byte is `\x1b`.
 * @returns The matched escape sequence, or `null` if `s` doesn't start
 *   with one we recognise.
 */
function matchAnsi(s: string): string | null {
    const match = s.match(/^\x1b(?:\[[\d;?]*[ -/]*[@-~]|\][^\x07]*\x07|[@-Z\\^_])/)
    return match ? match[0] : null
}

/**
 * Wrap `line` into rows of exactly `width` visible cells. Treats ANSI
 * escape sequences as zero-width pass-through and uses grapheme-aware
 * cell counting for printable text. Each emitted row is right-padded
 * with spaces so it occupies the full width.
 *
 * @param line Source text (may contain ANSI escapes).
 * @param width Target row width in visible cells.
 * @returns One or more wrapped rows. An empty input still produces one
 *   empty (padded) row.
 */
function wrapToRows(line: string, width: number): string[] {
    if (width <= 0) return [line]
    const rows: string[] = []
    let row = ""
    let rowWidth = 0
    let i = 0
    while (i < line.length) {
        if (line[i] === "\x1b") {
            const ansi = matchAnsi(line.slice(i))
            if (ansi) {
                row += ansi
                i += ansi.length
                continue
            }
        }
        const remainder = line.slice(i)
        const segIter = segmenter.segment(remainder)[Symbol.iterator]()
        const segNext = segIter.next()
        if (segNext.done) break
        const grapheme = segNext.value.segment
        const w = visibleWidth(grapheme)
        if (w === 0) {
            // Zero-width grapheme (combining marks etc.) attaches to the
            // current row without nudging the column counter.
            row += grapheme
            i += grapheme.length
            continue
        }
        if (rowWidth + w > width) {
            rows.push(row + " ".repeat(Math.max(0, width - rowWidth)))
            row = ""
            rowWidth = 0
        }
        row += grapheme
        rowWidth += w
        i += grapheme.length
    }
    rows.push(row + " ".repeat(Math.max(0, width - rowWidth)))
    return rows
}

/**
 * Walk the visible columns of `row`, returning the byte offset where the
 * accumulated visible width equals `targetCol`. Skips ANSI escapes and
 * counts graphemes by their visible width. Returns `row.length` if the
 * target column is past the end of the row.
 *
 * @param row Row text (may contain ANSI escapes).
 * @param targetCol Target visible column.
 * @returns Byte offset corresponding to `targetCol`.
 */
function byteOffsetForVisibleCol(row: string, targetCol: number): number {
    let col = 0
    let i = 0
    while (i < row.length) {
        if (col === targetCol) return i
        if (row[i] === "\x1b") {
            const ansi = matchAnsi(row.slice(i))
            if (ansi) {
                i += ansi.length
                continue
            }
        }
        const remainder = row.slice(i)
        const segNext = segmenter
            .segment(remainder)
            [Symbol.iterator]()
            .next()
        if (segNext.done) break
        const grapheme = segNext.value.segment
        const w = visibleWidth(grapheme)
        if (col + w > targetCol) return i
        col += w
        i += grapheme.length
    }
    return row.length
}

/**
 * Slice one grapheme starting at byte offset `start` in `row`, ignoring
 * any ANSI escapes that immediately precede it. Returns the grapheme
 * along with its byte length so the caller can splice around it.
 *
 * @param row Row text.
 * @param start Byte offset to read from.
 * @returns Grapheme and its byte length, or a single-space stand-in when
 *   `start` is at the end of the row.
 */
function graphemeAt(
    row: string,
    start: number
): { segment: string; length: number } {
    let i = start
    while (i < row.length && row[i] === "\x1b") {
        const ansi = matchAnsi(row.slice(i))
        if (!ansi) break
        i += ansi.length
    }
    const remainder = row.slice(i)
    const segNext = segmenter.segment(remainder)[Symbol.iterator]().next()
    if (segNext.done) return { segment: " ", length: 0 }
    return { segment: segNext.value.segment, length: segNext.value.segment.length }
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

        // Deletion. Word-level matchers run first so the shared byte `\x08`
        // (Ctrl+Backspace in browser xterm) routes to word delete; plain
        // Backspace arrives as `\x7f` and falls through to char delete.
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
     * Render the prompt + multi-line buffer with natural terminal-style
     * wrapping. Each logical line (`\n`-split) is concatenated with the
     * appropriate prefix (the colored prompt on line 0, empty string on
     * continuation lines) and wrapped into rows of `width` visible cells.
     * The cursor's visible column within its logical line determines
     * which wrapped row receives the reverse-video cursor decoration; a
     * cursor at the wrap boundary lands on column 0 of the next row,
     * matching xterm's natural wrap behaviour.
     *
     * @param width Terminal width in cells.
     * @returns Pre-wrapped rows, padded to `width`. The list spans every
     *   visual row the prompt occupies.
     */
    render(width: number): string[] {
        const safeWidth = Math.max(2, width)
        const lines = splitLines(this.value)
        const cursorPos = offsetToLineCol(this.value, this.cursor)
        const result: string[] = []
        for (let i = 0; i < lines.length; i++) {
            const isFirst = i === 0
            const isCursorLine = i === cursorPos.line
            const prefix = isFirst ? this.prompt : ""
            const prefixWidth = isFirst ? this.promptWidth : 0
            const text = lines[i].text
            const composed = prefix + text
            const rows = wrapToRows(composed, safeWidth)

            if (!isCursorLine) {
                result.push(...rows)
                continue
            }

            // Locate the cursor: visible column within the rendered line
            // (prefix + text), mapped onto the wrapped row grid.
            const cursorVisibleCol = prefixWidth + cursorPos.col
            const cursorRow = Math.floor(cursorVisibleCol / safeWidth)
            const cursorColInRow = cursorVisibleCol % safeWidth

            // Ensure a row exists at `cursorRow`. The wrap loop only emits
            // rows that contain content; if the cursor sits at the start
            // of a fresh wrapped row (e.g. one cell past the last char),
            // wrapToRows produces only `cursorRow` rows. Append an empty
            // padded row so the cursor has somewhere to land.
            while (rows.length <= cursorRow) {
                rows.push(" ".repeat(safeWidth))
            }

            const targetRow = rows[cursorRow]
            const splitOffset = byteOffsetForVisibleCol(targetRow, cursorColInRow)
            const before = targetRow.slice(0, splitOffset)
            const { segment: cursorChar, length: cursorByteLen } = graphemeAt(
                targetRow,
                splitOffset
            )
            const after = targetRow.slice(splitOffset + cursorByteLen)
            const marker = this.focused ? CURSOR_MARKER : ""
            const cursorRendered = `\x1b[7m${cursorChar}\x1b[27m`
            rows[cursorRow] = before + marker + cursorRendered + after
            result.push(...rows)
        }
        return result
    }
}
