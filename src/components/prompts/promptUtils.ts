/**
 * @file Helpers shared by every prompt component. Centralizes the
 * mount-message → focus-input → await-submit → replace-with-answer flow
 * so each prompt module can describe just its UX, not the lifecycle.
 */

import { Text } from "@mariozechner/pi-tui"
import type { Component, TUI } from "@mariozechner/pi-tui"
import { interpolate } from "../../shell/interpolate.js"
import { flatText, promptOpenColor, successColor } from "../../tui/theme.js"
import type { ComponentContext } from "../context.js"
import type { VariableStore } from "../../shell/VariableStore.js"
import { InlinePrompt } from "./InlinePrompt.js"
import type { InlinePromptOptions } from "./InlinePrompt.js"

/**
 * Build the leading prompt line shown above the active input UI. The `?`
 * glyph is light blue while the prompt is live to signal that input is
 * being captured.
 *
 * @param message Pre-interpolated message line.
 * @returns A pi-tui `Text` ready to be added as a child.
 */
export function messageLine(message: string): Text {
    return flatText(`${promptOpenColor("?")} ${message}`)
}

/**
 * Build the line shown after the prompt resolves: the leading glyph swaps
 * to a green `✔` and the resolved answer is rendered in green so the
 * scrollback distinguishes captured input from prompt prose.
 *
 * @param message Pre-interpolated message line.
 * @param answer User-facing rendering of the resolved value.
 * @returns A pi-tui `Text` ready to be added as a child.
 */
export function answerLine(message: string, answer: string): Text {
    return flatText(`${successColor("✔")} ${message} ${successColor(answer)}`)
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
 * Mount an {@link InlinePrompt} so the message and editable buffer share a
 * row, then resolve when the user submits or cancels. After resolution
 * the live prompt is removed and an {@link answerLine} is appended so the
 * captured input is preserved in scrollback.
 *
 * @param tui Owning TUI.
 * @param message Pre-interpolated message text.
 * @param opts Forwarded to the {@link InlinePrompt}; `message` is filled
 *   in automatically.
 * @param renderAnswer Maps the submitted string to the line shown after
 *   resolution; defaults to the raw value.
 * @returns The submitted string, or `undefined` if cancelled.
 */
export function runInlinePrompt(
    tui: TUI,
    message: string,
    opts: Omit<InlinePromptOptions, "message"> = {},
    renderAnswer: (value: string) => string = (v) => v
): Promise<string | undefined> {
    const prompt = new InlinePrompt({ ...opts, message })
    tui.addChild(prompt)
    tui.setFocus(prompt)
    tui.requestRender()
    return new Promise<string | undefined>((resolve) => {
        let settled = false
        const finish = (value: string | undefined, answer: string | null) => {
            if (settled) return
            settled = true
            tui.setFocus(null)
            tui.removeChild(prompt)
            if (answer !== null) tui.addChild(answerLine(message, answer))
            tui.requestRender()
            resolve(value)
        }
        prompt.onSubmit = (value) => finish(value, renderAnswer(value))
        prompt.onCancel = () => finish(undefined, null)
    })
}
