/**
 * @file Helpers shared by every prompt component. Centralizes the
 * mount-message → focus-input → await-submit → replace-with-answer flow
 * so each prompt module can describe just its UX, not the lifecycle.
 */

import { Input, Text } from "@mariozechner/pi-tui"
import type { Component, TUI } from "@mariozechner/pi-tui"
import { interpolate } from "../../shell/interpolate.js"
import { flatText, mutedColor } from "../../tui/theme.js"
import type { ComponentContext } from "../context.js"
import type { VariableStore } from "../../shell/VariableStore.js"

/**
 * Build the leading prompt line shown above the active input UI.
 *
 * @param message Pre-interpolated message line.
 * @returns A pi-tui `Text` ready to be added as a child.
 */
export function messageLine(message: string): Text {
    return flatText(`? ${message}`)
}

/**
 * Build the line shown after the prompt resolves. Mirrors the leading
 * line plus the muted resolved answer so scrollback reads naturally.
 *
 * @param message Pre-interpolated message line.
 * @param answer User-facing rendering of the resolved value.
 * @returns A pi-tui `Text` ready to be added as a child.
 */
export function answerLine(message: string, answer: string): Text {
    return flatText(`? ${message} ${mutedColor(answer)}`)
}

/**
 * Resolve the displayed message by interpolating against the merged
 * argv + variables context. Every prompt type calls this on its
 * `component.message`.
 *
 * @param message Raw message string from the component definition.
 * @param ctx Shared execution context.
 * @returns The interpolated message.
 */
export function renderMessage(
    message: string,
    ctx: ComponentContext
): string {
    return interpolate(message, ctx.argv, ctx.variables)
}

/**
 * Persist a prompt result under `name`. Prompt names are not part of the
 * declared `variables` bag, so we use {@link VariableStore.define} rather
 * than {@link VariableStore.set}.
 *
 * @param variables Target variable store.
 * @param name Variable key declared on the component definition.
 * @param value Resolved value. Strings round-trip; arrays/objects/booleans
 *   are JSON-stringified to keep the store's `string` value invariant.
 */
export function persist(
    variables: VariableStore,
    name: string,
    value: unknown
): void {
    variables.define(
        name,
        typeof value === "string" ? value : JSON.stringify(value)
    )
}

/**
 * Mount `body` under a message line, focus it, and resolve when the
 * caller invokes `done`. After the promise settles the live UI is
 * removed; if `answer` is non-null an {@link answerLine} is appended in
 * its place so the result remains visible.
 *
 * @param tui Owning TUI.
 * @param message Pre-interpolated message text.
 * @param body Live UI component (Input, SelectList, ...).
 * @param wire Callback that receives a `done(value, answer)` continuation;
 *   wires it to the body's submit/cancel events. `value === undefined` is
 *   the cancel sentinel.
 * @returns The resolved value, or `undefined` if cancelled.
 */
export function runInline<T>(
    tui: TUI,
    message: string,
    body: Component,
    wire: (done: (value: T | undefined, answer: string | null) => void) => void
): Promise<T | undefined> {
    const msg = messageLine(message)
    tui.addChild(msg)
    tui.addChild(body)
    tui.setFocus(body)
    tui.requestRender()

    return new Promise<T | undefined>((resolve) => {
        let settled = false
        wire((value, answer) => {
            if (settled) return
            settled = true
            tui.setFocus(null)
            tui.removeChild(body)
            tui.removeChild(msg)
            if (answer !== null) tui.addChild(answerLine(message, answer))
            tui.requestRender()
            resolve(value)
        })
    })
}

/**
 * Run a single pi-tui `Input`, optionally seeded with `initial`. Convenience
 * for the many prompts that are "ask a question, get a string back."
 *
 * @param tui Owning TUI.
 * @param message Pre-interpolated message text.
 * @param initial Seed value for the input.
 * @param renderAnswer Maps the submitted string to the line shown after
 *   resolution; defaults to the raw value.
 * @returns The submitted string, or `undefined` if cancelled.
 */
export function awaitInputLine(
    tui: TUI,
    message: string,
    initial = "",
    renderAnswer: (value: string) => string = (v) => v
): Promise<string | undefined> {
    const input = new Input()
    input.setValue(initial)
    return runInline<string>(tui, message, input, (done) => {
        input.onSubmit = (value) => done(value, renderAnswer(value))
        input.onEscape = () => done(undefined, null)
    })
}
