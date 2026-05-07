/**
 * @file `form` prompt — multi-field input rendered as a single block:
 *
 * ```
 * ? <heading>
 *   ◯ Field A: value-or-placeholder
 *   ✔ Field B: value
 *   ...
 * ```
 *
 * Every field is visible at once. Arrow Up/Down navigates between fields;
 * Tab accepts a grayed-out `initial` value as the buffer; Enter on the
 * last field submits the whole form. The leading bullet flips from muted
 * `◯` to green `✔` once a field is filled.
 */

import { CURSOR_MARKER, getKeybindings, visibleWidth } from "@mariozechner/pi-tui"
import type { Component, Focusable } from "@mariozechner/pi-tui"
import {
    flatText,
    mutedColor,
    promptOpenColor,
    successColor,
} from "../../tui/theme.js"
import type { FormChoice, FormComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { answerLine, persist, renderMessage } from "./promptUtils.js"

/** Single grapheme segmenter shared across instances. */
const segmenter = new Intl.Segmenter()

/**
 * Mutable per-field state. The `placeholder` is the `initial` value the
 * author supplied; once the user starts editing (or accepts via Tab) the
 * placeholder is no longer rendered and the buffer is the source of truth.
 */
interface FormField {
    name: string
    label: string
    placeholder: string
    buffer: string
    cursor: number
    /** True once the user has typed, accepted the placeholder, or moved past. */
    touched: boolean
}

/**
 * Multi-field form component. Owns the array of fields, the active-field
 * index, and the keystroke dispatch that routes editing operations to the
 * right field.
 */
class FormBlock implements Component, Focusable {
    /** Set by TUI when focus changes. */
    focused = false

    /** Invoked with `{ name: value }` once Enter on the last field fires. */
    onSubmit?: (result: Record<string, string>) => void
    /** Invoked when the user cancels (Escape / Ctrl+C). */
    onCancel?: () => void

    private readonly fields: FormField[]
    private active = 0

    /**
     * @param choices Field definitions from the schema.
     */
    constructor(choices: FormChoice[]) {
        this.fields = choices.map((c) => ({
            name: c.name,
            label: c.message,
            placeholder: c.initial ?? "",
            buffer: "",
            cursor: 0,
            touched: false,
        }))
    }

    /**
     * Pi-tui input dispatch. Routes navigation / submission keys at the
     * form level; everything else mutates the active field's buffer.
     *
     * @param data Raw bytes from the terminal.
     */
    handleInput(data: string): void {
        const kb = getKeybindings()

        if (data === "\x03") {
            this.onCancel?.()
            return
        }
        if (kb.matches(data, "tui.select.cancel")) {
            this.onCancel?.()
            return
        }

        if (kb.matches(data, "tui.editor.cursorUp")) {
            this.moveField(-1)
            return
        }
        if (kb.matches(data, "tui.editor.cursorDown")) {
            this.moveField(1)
            return
        }
        if (kb.matches(data, "tui.input.submit") || data === "\n") {
            // Final field → submit; otherwise advance like ArrowDown.
            const field = this.fields[this.active]
            this.commit(field)
            if (this.active === this.fields.length - 1) {
                this.submit()
            } else {
                this.moveField(1)
            }
            return
        }
        if (kb.matches(data, "tui.input.tab")) {
            const field = this.fields[this.active]
            if (field.buffer === "" && field.placeholder !== "") {
                field.buffer = field.placeholder
                field.cursor = field.buffer.length
                field.touched = true
            }
            return
        }

        // Editing keys all delegate to the active field.
        const field = this.fields[this.active]
        if (kb.matches(data, "tui.editor.cursorWordLeft")) {
            field.cursor = wordLeft(field.buffer, field.cursor)
            return
        }
        if (kb.matches(data, "tui.editor.cursorWordRight")) {
            field.cursor = wordRight(field.buffer, field.cursor)
            return
        }
        if (kb.matches(data, "tui.editor.cursorLeft")) {
            field.cursor = charLeft(field.buffer, field.cursor)
            return
        }
        if (kb.matches(data, "tui.editor.cursorRight")) {
            field.cursor = charRight(field.buffer, field.cursor)
            return
        }
        if (kb.matches(data, "tui.editor.cursorLineStart")) {
            field.cursor = 0
            return
        }
        if (kb.matches(data, "tui.editor.cursorLineEnd")) {
            field.cursor = field.buffer.length
            return
        }
        if (kb.matches(data, "tui.editor.deleteWordBackward")) {
            const start = wordLeft(field.buffer, field.cursor)
            field.buffer =
                field.buffer.slice(0, start) + field.buffer.slice(field.cursor)
            field.cursor = start
            field.touched = true
            return
        }
        if (kb.matches(data, "tui.editor.deleteWordForward")) {
            const end = wordRight(field.buffer, field.cursor)
            field.buffer =
                field.buffer.slice(0, field.cursor) + field.buffer.slice(end)
            field.touched = true
            return
        }
        if (kb.matches(data, "tui.editor.deleteCharBackward")) {
            if (field.cursor === 0) return
            const before = field.buffer.slice(0, field.cursor)
            const graphemes = [...segmenter.segment(before)]
            const last = graphemes[graphemes.length - 1]
            const len = last ? last.segment.length : 1
            field.buffer =
                field.buffer.slice(0, field.cursor - len) +
                field.buffer.slice(field.cursor)
            field.cursor -= len
            field.touched = true
            return
        }
        if (kb.matches(data, "tui.editor.deleteCharForward")) {
            if (field.cursor >= field.buffer.length) return
            const after = field.buffer.slice(field.cursor)
            const first = segmenter.segment(after)[Symbol.iterator]().next()
            const len = first.value ? first.value.segment.length : 1
            field.buffer =
                field.buffer.slice(0, field.cursor) +
                field.buffer.slice(field.cursor + len)
            field.touched = true
            return
        }

        const hasControlChars = [...data].some((ch) => {
            const code = ch.charCodeAt(0)
            return code < 32 || code === 0x7f || (code >= 0x80 && code <= 0x9f)
        })
        if (hasControlChars) return

        field.buffer =
            field.buffer.slice(0, field.cursor) +
            data +
            field.buffer.slice(field.cursor)
        field.cursor += data.length
        field.touched = true
    }

    /** Commit the current field — empty buffers fall back to the placeholder. */
    private commit(field: FormField): void {
        if (field.buffer === "" && field.placeholder !== "") {
            field.buffer = field.placeholder
            field.cursor = field.buffer.length
        }
        field.touched = true
    }

    /**
     * Move the active field index by `delta` rows, clamping to bounds.
     * Marks the previously active field as touched so its bullet flips to
     * the success color.
     *
     * @param delta -1 to move up, +1 to move down.
     */
    private moveField(delta: number): void {
        const next = this.active + delta
        if (next < 0 || next >= this.fields.length) return
        this.commit(this.fields[this.active])
        this.active = next
    }

    /** Build the result object and fire `onSubmit`. */
    private submit(): void {
        const result: Record<string, string> = {}
        for (const f of this.fields) {
            this.commit(f)
            result[f.name] = f.buffer
        }
        this.onSubmit?.(result)
    }

    /** No cached state. */
    invalidate(): void {}

    /**
     * Render the heading-less block of fields. The owning runner is
     * expected to render the `? <heading>` line above this.
     *
     * @param width Terminal width in cells.
     */
    render(width: number): string[] {
        const lines: string[] = []
        const labelWidth = Math.max(
            ...this.fields.map((f) => visibleWidth(f.label))
        )
        for (let i = 0; i < this.fields.length; i++) {
            const field = this.fields[i]
            const isActive = i === this.active
            const filled = field.touched && field.buffer !== ""
            const bullet = filled ? successColor("✔") : mutedColor("◯")
            const label = `${field.label}:`
            const labelPad = " ".repeat(
                Math.max(0, labelWidth - visibleWidth(field.label))
            )
            const value = this.renderValue(field, isActive)
            const marker = isActive && this.focused ? CURSOR_MARKER : ""
            const line = `  ${bullet} ${label}${labelPad} ${marker}${value}`
            const visualLength = visibleWidth(line)
            const pad = " ".repeat(Math.max(0, width - visualLength))
            lines.push(line + pad)
        }
        return lines
    }

    /**
     * Build the value column for one field. The active field draws its
     * cursor; inactive fields render either the typed buffer or the
     * grayed-out placeholder when nothing has been typed.
     */
    private renderValue(field: FormField, isActive: boolean): string {
        if (!field.touched && field.buffer === "" && field.placeholder !== "") {
            return mutedColor(field.placeholder)
        }
        if (!isActive) return field.buffer
        const before = field.buffer.slice(0, field.cursor)
        const afterAll = field.buffer.slice(field.cursor)
        const afterFirst = afterAll[Symbol.iterator]().next()
        const cursorChar = afterFirst.value ?? " "
        const after = afterAll.slice(cursorChar.length)
        const cursorRendered = `\x1b[7m${cursorChar}\x1b[27m`
        return `${before}${cursorRendered}${after}`
    }
}

function charLeft(buffer: string, cursor: number): number {
    if (cursor === 0) return 0
    const before = buffer.slice(0, cursor)
    const graphemes = [...segmenter.segment(before)]
    const last = graphemes[graphemes.length - 1]
    return cursor - (last ? last.segment.length : 1)
}

function charRight(buffer: string, cursor: number): number {
    if (cursor >= buffer.length) return buffer.length
    const after = buffer.slice(cursor)
    const first = segmenter.segment(after)[Symbol.iterator]().next()
    return cursor + (first.value ? first.value.segment.length : 1)
}

const PUNCTUATION = new Set(
    ".,;:!?'\"()[]{}<>/\\|`~@#$%^&*-_=+".split("")
)

function isWhitespace(ch: string): boolean {
    return ch === " " || ch === "\t"
}

function isPunctuation(ch: string): boolean {
    return ch.length === 1 && PUNCTUATION.has(ch)
}

function wordLeft(buffer: string, cursor: number): number {
    if (cursor === 0) return 0
    const before = buffer.slice(0, cursor)
    const graphemes = [...segmenter.segment(before)]
    let pos = cursor
    while (
        graphemes.length > 0 &&
        isWhitespace(graphemes[graphemes.length - 1].segment)
    ) {
        pos -= graphemes.pop()!.segment.length
    }
    if (graphemes.length === 0) return pos
    const last = graphemes[graphemes.length - 1].segment
    if (isPunctuation(last)) {
        while (
            graphemes.length > 0 &&
            isPunctuation(graphemes[graphemes.length - 1].segment)
        ) {
            pos -= graphemes.pop()!.segment.length
        }
    } else {
        while (
            graphemes.length > 0 &&
            !isWhitespace(graphemes[graphemes.length - 1].segment) &&
            !isPunctuation(graphemes[graphemes.length - 1].segment)
        ) {
            pos -= graphemes.pop()!.segment.length
        }
    }
    return pos
}

function wordRight(buffer: string, cursor: number): number {
    if (cursor >= buffer.length) return buffer.length
    const after = buffer.slice(cursor)
    const it = segmenter.segment(after)[Symbol.iterator]()
    let next = it.next()
    let pos = cursor
    while (!next.done && isWhitespace(next.value.segment)) {
        pos += next.value.segment.length
        next = it.next()
    }
    if (next.done) return pos
    const first = next.value.segment
    if (isPunctuation(first)) {
        while (!next.done && isPunctuation(next.value.segment)) {
            pos += next.value.segment.length
            next = it.next()
        }
    } else {
        while (
            !next.done &&
            !isWhitespace(next.value.segment) &&
            !isPunctuation(next.value.segment)
        ) {
            pos += next.value.segment.length
            next = it.next()
        }
    }
    return pos
}

/**
 * Mount a {@link FormBlock} under a `? <heading>` line, await submission,
 * and persist the resulting object as JSON under `component.name`.
 *
 * @param component Form component definition.
 * @param ctx Shared execution context.
 */
export async function runForm(
    component: FormComponent,
    ctx: ComponentContext
): Promise<void> {
    const heading = renderMessage(component.message, ctx)
    const headingLine = flatText(`${promptOpenColor("?")} ${heading}`)
    const block = new FormBlock(component.choices)
    ctx.tui.addChild(headingLine)
    ctx.tui.addChild(block)
    ctx.tui.setFocus(block)
    ctx.tui.requestRender()

    const result = await new Promise<Record<string, string> | undefined>(
        (resolve) => {
            let settled = false
            const finish = (
                value: Record<string, string> | undefined,
                answer: string | null
            ) => {
                if (settled) return
                settled = true
                ctx.tui.setFocus(null)
                ctx.tui.removeChild(block)
                ctx.tui.removeChild(headingLine)
                if (answer !== null) ctx.tui.addChild(answerLine(heading, answer))
                ctx.tui.requestRender()
                resolve(value)
            }
            block.onSubmit = (r) =>
                finish(
                    r,
                    Object.entries(r)
                        .map(([k, v]) => `${k}=${v}`)
                        .join(", ")
                )
            block.onCancel = () => finish(undefined, null)
        }
    )
    if (result !== undefined) persist(ctx.variables, component.name, result)
}
