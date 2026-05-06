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
 * Numeric input. Reuses the plain `Input` and parses on submit; non-numeric
 * input is rejected by leaving the resolved value as `NaN`-stringified
 * — matches the legacy enquirer behaviour of trusting the user to type a
 * number.
 *
 * @param component Number component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the user submits or cancels.
 */
export async function runNumber(
    component: NumberComponent,
    ctx: ComponentContext
): Promise<void> {
    const message = renderMessage(component.message, ctx)
    const raw = await awaitInputLine(ctx.tui, message)
    if (raw === undefined) return
    const parsed = Number(raw)
    persist(ctx.variables, component.name, String(parsed))
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
