/**
 * @file Single-line text prompt family: `input`, `number`, `password`, and
 * `invisible`. All four read one value from the user and persist it under
 * `component.name`; the masked variants swap pi-tui's `Input` for a small
 * {@link MaskedInput} that never echoes the buffer.
 */

import type {
    InputComponent,
    InvisibleComponent,
    NumberComponent,
    PasswordComponent,
} from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { MaskedInput } from "./MaskedInput.js"
import {
    awaitInputLine,
    persist,
    renderMessage,
    runInline,
} from "./promptUtils.js"

/**
 * Plain text input. Resolves to the submitted string and persists it
 * verbatim.
 *
 * @param component Input component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user submits or cancels.
 */
export async function runInput(
    component: InputComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const value = await awaitInputLine(ctx.tui, message, component.initial ?? "")
    if (value !== undefined) persist(ctx.variables, component.name, value)
}

/**
 * Numeric input. Reads a line, validates it parses as a finite number,
 * and re-prompts on invalid input. Persists the canonical numeric string
 * (e.g. `"42"`, `"3.14"`).
 *
 * @param component Number component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user submits a valid number
 *   or cancels.
 */
export async function runNumber(
    component: NumberComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    while (true) {
        const raw = await awaitInputLine(ctx.tui, message)
        if (raw === undefined) return
        const parsed = Number(raw)
        if (raw.trim() !== "" && Number.isFinite(parsed)) {
            persist(ctx.variables, component.name, String(parsed))
            return
        }
        // Re-prompt on invalid entry. The `awaitInputLine` answer line
        // already lands in scrollback, so the operator sees their bad
        // input alongside the fresh prompt.
    }
}

/**
 * Password input. Renders a `•` for each typed character and persists the
 * raw value under `component.name`.
 *
 * @param component Password component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user submits or cancels.
 */
export async function runPassword(
    component: PasswordComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const body = new MaskedInput({ kind: "mask", char: "•" })
    const value = await runInline<string>(ctx.tui, message, body, (done) => {
        body.onSubmit = (v) => done(v, "•".repeat(v.length))
        body.onEscape = () => done(undefined, null)
    })
    if (value !== undefined) persist(ctx.variables, component.name, value)
}

/**
 * Invisible input. Hides the buffer entirely while typing; persists the
 * raw value under `component.name`.
 *
 * @param component Invisible component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user submits or cancels.
 */
export async function runInvisible(
    component: InvisibleComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const body = new MaskedInput({ kind: "hidden" })
    const value = await runInline<string>(ctx.tui, message, body, (done) => {
        body.onSubmit = (v) => done(v, "")
        body.onEscape = () => done(undefined, null)
    })
    if (value !== undefined) persist(ctx.variables, component.name, value)
}
