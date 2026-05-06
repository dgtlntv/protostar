/**
 * @file Top-level shell read-eval loop. Mounts a {@link PromptLine}, awaits
 * a complete command line, parses it with `shell-quote` + yargs, runs the
 * matched handler, then loops. Replaces the legacy
 * `inputHandler(localEcho, term, yargs)` flow.
 */

import type { TUI } from "@mariozechner/pi-tui"
import { parse } from "shell-quote"
import type Yargs from "yargs/browser"
import { PromptLine } from "./PromptLine.js"
import type { HistoryStore } from "./HistoryStore.js"
import { isIncomplete } from "./isIncomplete.js"
import { flatText } from "../tui/theme.js"

type YargsInstance = ReturnType<typeof Yargs>

/**
 * Wires a {@link PromptLine} to a yargs instance and runs the read → parse →
 * dispatch → repeat loop.
 *
 * The loop is "always running" once {@link start} is called: after a command
 * resolves, the prompt is re-mounted and another submit is awaited. There's
 * no terminal state — closing the page or `dispose()` on the host is the
 * only way out.
 */
export class ShellLoop {
    private readonly tui: TUI
    private readonly yargs: YargsInstance
    private readonly history: HistoryStore
    private readonly prompt: string

    /** Buffer holding partial input across continuation lines. */
    private pending = ""
    /** Live PromptLine while idle; `null` while a command is running. */
    private active: PromptLine | null = null

    /**
     * @param opts.tui Shared TUI; the prompt mounts here.
     * @param opts.yargs Configured yargs instance (built by `buildYargs`).
     * @param opts.history Shared history store; surviving across prompts.
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

    /**
     * Begin the loop. Mounts the first prompt; subsequent prompts are
     * mounted automatically after each command resolves.
     */
    start(): void {
        void this.cycle()
    }

    /** @returns The PromptLine currently mounted, or `null` while running. */
    get currentPrompt(): PromptLine | null {
        return this.active
    }

    /** @returns The pending continuation buffer (empty between commands). */
    get pendingInput(): string {
        return this.pending
    }

    private async cycle(): Promise<void> {
        // Loop forever — every iteration mounts a prompt, awaits a complete
        // line, then dispatches it.
        // eslint-disable-next-line no-constant-condition
        while (true) {
            const line = await this.readLine()
            this.history.push(line)
            this.history.rewind()
            await this.dispatch(line)
        }
    }

    /**
     * Mount a PromptLine and accumulate continuation lines until the result
     * is a complete command. Resolves the assembled multi-line input.
     */
    private readLine(): Promise<string> {
        return new Promise((resolve) => {
            const tryFinish = (raw: string) => {
                const combined = this.pending
                    ? this.pending + "\n" + raw
                    : raw
                if (isIncomplete(combined)) {
                    // Roll into a continuation. Move the submitted line
                    // into the scrollback so the next prompt starts fresh.
                    this.pending = combined
                    this.tui.removeChild(promptLine)
                    this.tui.addChild(flatText(this.prompt + raw))
                    promptLine = this.mountPrompt()
                    promptLine.onSubmit = (next) => tryFinish(next)
                    return
                }
                this.pending = ""
                this.tui.removeChild(promptLine)
                this.active = null
                this.tui.addChild(flatText(this.prompt + raw))
                this.tui.requestRender()
                resolve(combined)
            }

            let promptLine = this.mountPrompt()
            promptLine.onSubmit = (raw) => tryFinish(raw)
        })
    }

    private mountPrompt(): PromptLine {
        const promptLine = new PromptLine(this.prompt, this.history)
        this.tui.addChild(promptLine)
        this.tui.setFocus(promptLine)
        this.tui.requestRender()
        this.active = promptLine
        return promptLine
    }

    private async dispatch(input: string): Promise<void> {
        if (input.trim() === "") return
        const tokens = parse(input)
            .filter((tok): tok is string => typeof tok === "string")
        await new Promise<void>((resolve) => {
            this.yargs.parse(
                tokens,
                (_err: Error | undefined, _argv: unknown, output: string) => {
                    if (output) {
                        this.tui.addChild(flatText(output))
                        this.tui.requestRender()
                    }
                    resolve()
                }
            )
        })
    }
}
