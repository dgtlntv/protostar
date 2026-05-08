/**
 * @file Single-line text prompt family: `input`, `number`, `password`, and
 * `invisible`. All four read one value from the user and persist it under
 * `component.name`. Each renders the message and the editable buffer on
 * one row via {@link runInlinePrompt}; password/invisible swap the value
 * for a masked or hidden display, and number filters keystrokes to digits
 * and the decimal/leading-sign characters.
 */

import type {
    InputComponent,
    InvisibleComponent,
    NumberComponent,
    PasswordComponent,
} from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { persist, renderMessage, runInlinePrompt } from "./promptUtils.js"

/**
 * Plain text input. Resolves to the submitted string and persists it
 * verbatim.
 *
 * @param component Input component definition.
 * @param ctx Shared execution context.
 */
export async function runInput(
    component: InputComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const value = await runInlinePrompt({
        tui: ctx.tui,
        message,
        promptOptions: { initial: component.initial ?? "" },
        signal: ctx.signal,
    })
    if (value !== undefined) persist(ctx.variables, component.name, value)
}

/**
 * Filter that accepts only characters that can be part of a JS number
 * literal: digits, optional leading `-`, optional `.`, and exponent
 * markers `e`/`E`/`+`. Re-validation happens after submit; the filter
 * just keeps obvious garbage out of the buffer.
 */
function numberKey(ch: string): boolean {
    return /[0-9.\-+eE]/.test(ch)
}

/**
 * Numeric input. Filters keystrokes so non-numeric characters don't enter
 * the buffer, then re-prompts on submit if the trimmed value still does
 * not parse to a finite number. Persists the canonical numeric string.
 *
 * @param component Number component definition.
 * @param ctx Shared execution context.
 */
export async function runNumber(
    component: NumberComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    while (true) {
        if (ctx.signal?.aborted) return
        const raw = await runInlinePrompt({
            tui: ctx.tui,
            message,
            promptOptions: { accept: numberKey },
            signal: ctx.signal,
        })
        if (raw === undefined) return
        const parsed = Number(raw)
        if (raw.trim() !== "" && Number.isFinite(parsed)) {
            persist(ctx.variables, component.name, String(parsed))
            return
        }
    }
}

/**
 * Password input. Renders a `•` for each typed character and persists the
 * raw value under `component.name`.
 *
 * @param component Password component definition.
 * @param ctx Shared execution context.
 */
export async function runPassword(
    component: PasswordComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const value = await runInlinePrompt({
        tui: ctx.tui,
        message,
        promptOptions: { mask: { kind: "mask", char: "•" } },
        renderAnswer: (v) => "•".repeat([...v].length),
        signal: ctx.signal,
    })
    if (value !== undefined) persist(ctx.variables, component.name, value)
}

/**
 * Invisible input. Hides the buffer entirely while typing; persists the
 * raw value under `component.name`.
 *
 * @param component Invisible component definition.
 * @param ctx Shared execution context.
 */
export async function runInvisible(
    component: InvisibleComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const value = await runInlinePrompt({
        tui: ctx.tui,
        message,
        promptOptions: { mask: { kind: "hidden" } },
        renderAnswer: () => "",
        signal: ctx.signal,
    })
    if (value !== undefined) persist(ctx.variables, component.name, value)
}
