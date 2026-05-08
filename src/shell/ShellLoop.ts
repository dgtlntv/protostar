/**
 * @file Top-level shell read-eval loop. Mounts a {@link PromptLine}, awaits
 * one or more shell-complete lines, parses each with `shell-quote` + yargs,
 * runs the matched handler, then loops. The prompt itself owns the full
 * continuation buffer (newlines included), so this loop is event-driven:
 * it reacts to `onComplete` (a list of submitted lines, possibly more than
 * one when a multi-line paste lands several complete chunks at once) and
 * `onCancel` (Ctrl+C) without managing intermediate continuation state.
 */

import type { TUI } from "@mariozechner/pi-tui"
import { parse } from "shell-quote"
import type Yargs from "yargs/browser"
import { PromptLine } from "./PromptLine.js"
import type { HistoryStore } from "./HistoryStore.js"
import { flatText } from "../tui/theme.js"

type YargsInstance = ReturnType<typeof Yargs>

/**
 * Wires a {@link PromptLine} to a yargs instance and runs the read → parse →
 * dispatch → repeat loop.
 *
 * The loop is "always running" once {@link start} is called: after a command
 * (or a queued batch of commands from a multi-line paste) resolves, the
 * prompt is re-mounted and another submission is awaited.
 */
export class ShellLoop {
    private readonly tui: TUI
    private readonly yargs: YargsInstance
    private readonly history: HistoryStore
    private readonly prompt: string

    /** Live prompt while idle; `null` while a command is running. */
    private active: PromptLine | null = null
    /** Lines submitted but not yet dispatched (filled by paste). */
    private readonly queue: string[] = []
    /** Whether the drain loop is currently running. */
    private dispatching = false
    /** Paste tail that should seed the next prompt's buffer. */
    private carryover = ""
    /**
     * Per-dispatch cancellation source. Non-null only while a command is
     * mid-flight; `cancelDispatch()` aborts it to propagate Ctrl+C into
     * every long-running component.
     */
    private activeAbort: AbortController | null = null

    /**
     * @param opts.tui Shared TUI; the prompt mounts here.
     * @param opts.yargs Configured yargs instance (built by `buildYargs`).
     * @param opts.history Shared history store; survives across prompts.
     * @param opts.prompt Pre-rendered prompt prefix.
     */
    constructor(opts: {
        tui: TUI
        yargs: YargsInstance
        history: HistoryStore
        prompt: string
    }) {
        this.tui = opts.tui
        this.yargs = opts.yargs
        this.history = opts.history
        this.prompt = opts.prompt
    }

    /** Begin the loop by mounting the first prompt. */
    start(): void {
        this.mountPrompt()
    }

    /** @returns The PromptLine currently mounted, or `null` while running. */
    get currentPrompt(): PromptLine | null {
        return this.active
    }

    /**
     * @returns The cancel signal for the in-flight dispatch, or
     *   `undefined` when the loop is idle. Read by `buildYargs` when
     *   constructing each handler's `ComponentContext`.
     */
    get currentSignal(): AbortSignal | undefined {
        return this.activeAbort?.signal
    }

    /** @returns `true` while a command is mid-flight (queue or active). */
    get isDispatching(): boolean {
        return this.dispatching
    }

    /**
     * Cancel the in-flight command (Ctrl+C while a handler is running).
     * Aborts every long-running component via the shared signal, drops any
     * queued paste lines, and prints `^C` to scrollback. Safe to call when
     * idle — it's a no-op in that case.
     */
    cancelDispatch(): void {
        if (!this.activeAbort) return
        this.activeAbort.abort()
        // Drop any queued paste lines so a multi-line paste doesn't keep
        // running after Ctrl+C — matches bash, where SIGINT abandons the
        // rest of a pasted command sequence.
        this.queue.length = 0
        this.tui.addChild(flatText("^C"))
        this.tui.requestRender()
    }

    /**
     * Mount a fresh prompt and wire its `onComplete` / `onCancel`
     * callbacks. If a paste tail was carried over from a previous prompt,
     * seed the new buffer with it so the user can continue editing.
     */
    private mountPrompt(): void {
        const prompt = new PromptLine(this.prompt, this.history)
        prompt.onComplete = (lines) => this.handleSubmissions(lines)
        prompt.onCancel = () => this.handleCancel()
        if (this.carryover) {
            prompt.setValue(this.carryover)
            this.carryover = ""
        }
        this.tui.addChild(prompt)
        this.tui.setFocus(prompt)
        this.tui.requestRender()
        this.active = prompt
    }

    /**
     * One or more shell-complete lines were just submitted. Capture the
     * paste tail (whatever the prompt has left in its buffer) as the next
     * prompt's seed, flush the prompt + each submitted line to scrollback,
     * push each to history, and kick off the drain loop.
     *
     * @param lines Submitted lines, in dispatch order.
     */
    private handleSubmissions(lines: string[]): void {
        if (!this.active) return
        // Whatever the prompt still holds becomes the seed for the next
        // prompt — that's the post-last-`\n` paste tail.
        this.carryover = this.active.getValue()
        this.tui.removeChild(this.active)
        this.active = null
        for (const line of lines) {
            this.tui.addChild(flatText(this.prompt + line))
            this.history.push(line)
        }
        this.history.rewind()
        this.tui.requestRender()
        this.queue.push(...lines)
        if (!this.dispatching) {
            void this.drainQueue()
        }
    }

    /**
     * Cancel the current line via Ctrl+C. Flushes `<prompt><value>^C` to
     * scrollback (the value may span multiple logical lines for a
     * mid-continuation cancel), rewinds history so the next ArrowUp returns
     * the most recent submitted command (not the cancelled partial), and
     * remounts a fresh empty prompt. Does not push to history; does not
     * dispatch.
     */
    private handleCancel(): void {
        if (!this.active) return
        const value = this.active.getValue()
        this.tui.removeChild(this.active)
        this.active = null
        this.tui.addChild(flatText(this.prompt + value + "^C"))
        this.history.rewind()
        this.carryover = ""
        this.tui.requestRender()
        this.mountPrompt()
    }

    /**
     * Dispatch every queued line in turn, awaiting each command before
     * starting the next. After the queue empties, mount a fresh prompt
     * (which picks up any paste tail via `carryover`).
     */
    private async drainQueue(): Promise<void> {
        this.dispatching = true
        try {
            while (this.queue.length > 0) {
                const line = this.queue.shift()!
                await this.dispatch(line)
            }
        } finally {
            this.dispatching = false
        }
        this.mountPrompt()
    }

    /**
     * Tokenize `input` with `shell-quote`, hand the resulting positional
     * tokens to yargs, and surface any rendered output as scrollback.
     *
     * Manages a per-dispatch {@link AbortController}: each call installs
     * a fresh controller on `activeAbort` so the buildYargs `getSignal`
     * closure picks it up when the handler builds its
     * {@link ComponentContext}. A `CommandCanceledError` thrown by the
     * handler (in response to {@link cancelDispatch}) is swallowed — the
     * `^C` line was already emitted by `cancelDispatch` — so the drain
     * loop continues to the next prompt instead of unwinding.
     *
     * @param input The complete command line.
     */
    private async dispatch(input: string): Promise<void> {
        if (input.trim() === "") return
        const tokens = parse(input).filter(
            (tok): tok is string => typeof tok === "string"
        )
        const abort = new AbortController()
        this.activeAbort = abort
        try {
            // yargs uses an internal freeze/unfreeze guard during `parse`.
            // For async handlers the parseFn callback fires before yargs
            // unfreezes (the unfreeze runs in a `.finally`), so awaiting
            // only the callback would let the next `parse` re-enter while
            // still frozen — which makes yargs misparse the second
            // command as an unknown argument to the first. Awaiting the
            // Promise that `parse` returns waits past the unfreeze so
            // re-entry is safe.
            let captured = ""
            const result = this.yargs.parse(
                tokens,
                (_err: Error | undefined, _argv: unknown, output: string) => {
                    captured = output ?? ""
                }
            )
            if (
                result !== null &&
                typeof result === "object" &&
                "then" in (result as Record<string, unknown>) &&
                typeof (result as { then: unknown }).then === "function"
            ) {
                await (result as Promise<unknown>)
            }
            if (captured) {
                this.tui.addChild(flatText(captured))
                this.tui.requestRender()
            }
        } finally {
            this.activeAbort = null
        }
    }
}
