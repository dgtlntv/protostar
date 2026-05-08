/**
 * @file Helpers shared by every prompt component. Centralizes the
 * mount-message → focus-input → await-submit → replace-with-answer flow
 * so each prompt module can describe just its UX, not the lifecycle.
 *
 * Snapshot policy on Ctrl+C abort:
 * - SelectList-style prompts (`select`, `autoComplete`, `multiSelect`,
 *   `sort`, `form`): {@link runInline} mounts a separate
 *   {@link messageLine} above the body. On abort the body is removed and
 *   the message line is left as the snapshot.
 * - Body-owns-message prompts (`confirm`, `toggle`): the body renders its
 *   own `? <message>` prefix. {@link runInline} is called with
 *   `bodyOwnsMessage: true`, and on abort a fresh {@link messageLine} is
 *   appended in place of the removed body so the cancelled prompt is
 *   still labelled.
 * - {@link InlinePrompt} family (`input`, `number`, `password`,
 *   `invisible`, `list`, `basicAuth`): {@link runInlinePrompt} replaces
 *   the live prompt with `? <message> <displayed buffer>` so the user's
 *   partial answer survives in scrollback. Mask/hidden modes preserve
 *   the mask, never the plaintext.
 *
 * The dispatcher writes the trailing `^C` separately, so prompts only
 * own their own snapshot rendering.
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
 * Continuation handed to {@link RunInlineOptions.wire}. Pass `null` for
 * `answer` to suppress the success {@link answerLine} (e.g. on a quiet
 * cancel from the body itself, distinct from a Ctrl+C abort).
 */
export type RunInlineDone<T> = (
    value: T | undefined,
    answer: string | null
) => void

/** Options for {@link runInline}. */
export interface RunInlineOptions<T> {
    /** Owning TUI. */
    tui: TUI
    /** Pre-interpolated message text drawn above the body. */
    message: string
    /** Live UI component. Removed on every resolve path. */
    body: Component
    /** Wires the body's submit/cancel events to a `done` continuation. */
    wire: (done: RunInlineDone<T>) => void
    /** Cancel signal threaded from `ComponentContext`. */
    signal?: AbortSignal
    /**
     * If `true`, the body renders its own message and `runInline` will not
     * mount a separate {@link messageLine} above it. Used by `confirm` and
     * `toggle`, whose body components own the `? <message>` prefix.
     * Defaults to `false`.
     */
    bodyOwnsMessage?: boolean
    /**
     * Override what stays in scrollback after `signal` aborts. Default
     * snapshot policy:
     *   - `bodyOwnsMessage === false` (the common case): the
     *     {@link messageLine} that was already on screen is left as-is.
     *   - `bodyOwnsMessage === true`: a fresh `messageLine(message)` is
     *     appended so the cancelled prompt is still labelled.
     * Callers that want a richer snapshot (e.g. `InlinePrompt`'s
     * "preserve the typed buffer") pass an override.
     */
    abortSnapshot?: () => Text
}

/**
 * Mount `body` (optionally above a {@link messageLine}), focus it, and
 * resolve when the caller's `wire` continuation fires. After the promise
 * settles the live UI is removed; if `answer` is non-null an
 * {@link answerLine} is appended in its place so the result remains
 * visible.
 *
 * On Ctrl+C the body is torn down and a snapshot is left in scrollback
 * per {@link RunInlineOptions.abortSnapshot}. The dispatcher prints the
 * trailing `^C` separately.
 *
 * @param opts See {@link RunInlineOptions}.
 * @returns The resolved value, or `undefined` if cancelled.
 */
export function runInline<T>(opts: RunInlineOptions<T>): Promise<T | undefined> {
    const { tui, message, body, wire, signal, bodyOwnsMessage, abortSnapshot } =
        opts
    const msg = bodyOwnsMessage ? null : messageLine(message)
    if (msg) tui.addChild(msg)
    tui.addChild(body)
    tui.setFocus(body)
    tui.requestRender()

    return new Promise<T | undefined>((resolve) => {
        let settled = false
        const onAbort = () => {
            if (settled) return
            settled = true
            tui.setFocus(null)
            tui.removeChild(body)
            if (abortSnapshot) {
                tui.addChild(abortSnapshot())
            } else if (bodyOwnsMessage) {
                tui.addChild(messageLine(message))
            }
            // When `bodyOwnsMessage` is false, the messageLine added above
            // is the snapshot and stays in `children` automatically.
            tui.requestRender()
            resolve(undefined)
        }
        if (signal) {
            if (signal.aborted) {
                onAbort()
                return
            }
            signal.addEventListener("abort", onAbort, { once: true })
        }
        wire((value, answer) => {
            if (settled) return
            settled = true
            signal?.removeEventListener("abort", onAbort)
            tui.setFocus(null)
            tui.removeChild(body)
            if (msg) tui.removeChild(msg)
            if (answer !== null) tui.addChild(answerLine(message, answer))
            tui.requestRender()
            resolve(value)
        })
    })
}

/** Options for {@link runInlinePrompt}. */
export interface RunInlinePromptOptions {
    /** Owning TUI. */
    tui: TUI
    /** Pre-interpolated message text. */
    message: string
    /** Forwarded to the {@link InlinePrompt}; `message` is filled in automatically. */
    promptOptions?: Omit<InlinePromptOptions, "message">
    /**
     * Maps the submitted string to the line shown after resolution and to
     * the abort snapshot. Defaults to the raw value (so plain prompts show
     * the typed text; mask-mode prompts pass `(v) => "•".repeat(v.length)`
     * to keep the secret out of scrollback).
     */
    renderAnswer?: (value: string) => string
    /** Cancel signal threaded from `ComponentContext`. */
    signal?: AbortSignal
}

/**
 * Mount an {@link InlinePrompt} so the message and editable buffer share a
 * row, then resolve when the user submits or cancels. After resolution
 * the live prompt is removed and an {@link answerLine} is appended so the
 * captured input is preserved in scrollback.
 *
 * On Ctrl+C the live prompt is replaced with a frozen
 * `? <message> <displayed buffer>` snapshot (no green styling — the
 * prompt did not succeed) so the user's partial answer remains visible.
 *
 * @param opts See {@link RunInlinePromptOptions}.
 * @returns The submitted string, or `undefined` if cancelled.
 */
export function runInlinePrompt(
    opts: RunInlinePromptOptions
): Promise<string | undefined> {
    const { tui, message, signal } = opts
    const renderAnswer = opts.renderAnswer ?? ((v: string) => v)
    const prompt = new InlinePrompt({ ...opts.promptOptions, message })
    tui.addChild(prompt)
    tui.setFocus(prompt)
    tui.requestRender()
    return new Promise<string | undefined>((resolve) => {
        let settled = false
        const onAbort = () => {
            if (settled) return
            settled = true
            const snapshot = renderAnswer(prompt.getValue())
            tui.setFocus(null)
            tui.removeChild(prompt)
            tui.addChild(
                flatText(`${promptOpenColor("?")} ${message} ${snapshot}`)
            )
            tui.requestRender()
            resolve(undefined)
        }
        if (signal) {
            if (signal.aborted) {
                onAbort()
                return
            }
            signal.addEventListener("abort", onAbort, { once: true })
        }
        const finish = (value: string | undefined, answer: string | null) => {
            if (settled) return
            settled = true
            signal?.removeEventListener("abort", onAbort)
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
