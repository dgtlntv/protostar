/**
 * @file `select` and `autoComplete` prompts. Both render a list of choices
 * and let the user pick one; `autoComplete` adds a filter input above the
 * list so typing narrows the visible options.
 */

import { Input, SelectList } from "@mariozechner/pi-tui"
import type {
    Component,
    Focusable,
    SelectItem,
    SelectListTheme,
} from "@mariozechner/pi-tui"
import chalk from "chalk"
import { accentColor, mutedColor } from "../../tui/theme.js"
import type {
    AutoCompleteComponent,
    SelectChoice,
    SelectComponent,
} from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { persist, renderMessage, runInline } from "./promptUtils.js"

/** Default theme for the select-style prompts. Single source for both. */
const SELECT_THEME: SelectListTheme = {
    selectedPrefix: (t) => accentColor(t),
    selectedText: (t) => accentColor(t),
    description: (t) => mutedColor(t),
    scrollInfo: (t) => mutedColor(t),
    noMatch: (t) => mutedColor(t),
}

/**
 * Normalize the union of choice shapes that `select` accepts (a bare
 * `string[]` or a list of `SelectChoice` objects) into the `SelectItem`
 * shape pi-tui expects. Returns the raw `value` field (or the string
 * itself when the choice is a string) on submit.
 *
 * @param choices Choices as authored in `commands.json`.
 * @returns Items ready to feed into a pi-tui `SelectList`.
 */
function toSelectItems(
    choices: string[] | SelectChoice[] | undefined
): SelectItem[] {
    if (!choices) return []
    return choices.map((c) =>
        typeof c === "string"
            ? { value: c, label: c }
            : { value: c.value, label: c.message ?? c.name }
    )
}

/**
 * Plain `select` prompt. Mounts a `SelectList`, resolves with the chosen
 * item's `value`, and persists it under `component.name`.
 *
 * @param component Select component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once a choice is made or the prompt
 *   is cancelled.
 */
export async function runSelect(
    component: SelectComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const items = toSelectItems(component.choices)
    const list = new SelectList(items, Math.min(items.length || 1, 8), SELECT_THEME)
    const value = await runInline<string>({
        tui: ctx.tui,
        message,
        body: list,
        wire: (done) => {
            list.onSelect = (item) => done(item.value, item.label)
            list.onCancel = () => done(undefined, null)
        },
        signal: ctx.signal,
    })
    if (value !== undefined) persist(ctx.variables, component.name, value)
}

/**
 * Composite component for `autoComplete`: an `Input` drives a `SelectList`
 * via `setFilter`. Up/Down arrows navigate the list; everything else goes
 * to the input. Enter resolves with the currently-highlighted item.
 *
 * The combo also passes the live filter into the `SelectList` layout so
 * the matched prefix on each visible item is highlighted in yellow.
 */
class AutoCompleteCombo implements Component, Focusable {
    /** Set by TUI when focus changes. */
    focused = false
    /** Invoked with the picked value. */
    onSelect?: (item: SelectItem) => void
    /** Invoked when the user cancels. */
    onCancel?: () => void

    private readonly input = new Input()
    private filter = ""

    /**
     * @param list The list to filter and pick from.
     */
    constructor(private readonly list: SelectList) {
        this.input.onSubmit = () => {
            const item = this.list.getSelectedItem()
            if (item) this.onSelect?.(item)
        }
        this.input.onEscape = () => this.onCancel?.()
    }

    /** @returns The current filter string. */
    getFilter(): string {
        return this.filter
    }

    /** Forward arrow/cancel/confirm to the list and the rest to the input. */
    handleInput(data: string): void {
        if (data === "\x1b[A" || data === "\x1bOA") {
            this.list.handleInput(data)
            return
        }
        if (data === "\x1b[B" || data === "\x1bOB") {
            this.list.handleInput(data)
            return
        }
        const before = this.input.getValue()
        this.input.handleInput(data)
        const after = this.input.getValue()
        if (after !== before) {
            this.filter = after
            this.list.setFilter(after)
        }
    }

    /** Forward focus state to the input so it owns the cursor marker. */
    invalidate(): void {
        this.input.focused = this.focused
        this.input.invalidate()
        this.list.invalidate()
    }

    /**
     * Stack the input above the filtered list.
     *
     * @param width Available width.
     */
    render(width: number): string[] {
        this.input.focused = this.focused
        return [...this.input.render(width), ...this.list.render(width)]
    }
}

/**
 * `autoComplete` prompt. Stacks a filter input above a `SelectList`;
 * resolves with the selected item's `value`. The `SelectList` is
 * configured with a `truncatePrimary` callback that wraps the matched
 * prefix in yellow so the user can see what their typed filter is
 * matching, distinct from the cyan that marks the active row.
 *
 * @param component AutoComplete component definition.
 * @param ctx Shared execution context.
 */
export async function runAutoComplete(
    component: AutoCompleteComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const items = toSelectItems(component.choices)
    const limit = component.limit ?? Math.min(items.length || 1, 8)
    let combo: AutoCompleteCombo | null = null
    const list = new SelectList(items, limit, SELECT_THEME, {
        truncatePrimary: ({ text }) => {
            const filter = combo?.getFilter() ?? ""
            if (filter === "") return text
            const lowerText = text.toLowerCase()
            const lowerFilter = filter.toLowerCase()
            if (!lowerText.startsWith(lowerFilter)) return text
            const head = text.slice(0, filter.length)
            const tail = text.slice(filter.length)
            return `${chalk.yellow(head)}${tail}`
        },
    })
    if (component.initial !== undefined) list.setSelectedIndex(component.initial)
    combo = new AutoCompleteCombo(list)
    const value = await runInline<string>({
        tui: ctx.tui,
        message,
        body: combo,
        wire: (done) => {
            combo!.onSelect = (item) => done(item.value, item.label)
            combo!.onCancel = () => done(undefined, null)
        },
        signal: ctx.signal,
    })
    if (value !== undefined) persist(ctx.variables, component.name, value)
}
