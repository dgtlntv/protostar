/**
 * @file `spinner` component. Renders a single-row animated loader on a
 * timer, optionally cycling through a list of phrases, and replaces the
 * live row with a static line carrying a conclusion glyph (`✔` / `✖`).
 */

import type { Component, TUI } from "@mariozechner/pi-tui"
import type { SpinnerComponent } from "../types/commands.js"
import { interpolate } from "../shell/interpolate.js"
import { LOG_SYMBOLS, accentColor, flatText, mutedColor } from "../tui/theme.js"
import type { ComponentContext } from "./context.js"
import { resolveDuration, sleep } from "./duration.js"

/** Frames cycled by the spinner. Matches pi-tui's default loader frames. */
const FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
/** Frame interval in ms. */
const FRAME_INTERVAL_MS = 80

/**
 * One-row spinner component. Advances the frame on a timer driven by the
 * embedder; stop the timer with {@link stop}.
 */
class SpinnerLine implements Component {
    private message: string
    private frame = 0
    private interval: ReturnType<typeof setInterval> | null = null

    /**
     * @param tui Owning TUI; re-rendered on every frame tick.
     * @param initial Initial message body.
     */
    constructor(
        private readonly tui: TUI,
        initial: string
    ) {
        this.message = initial
        this.start()
    }

    /** Replace the displayed message body. */
    setMessage(message: string): void {
        this.message = message
        this.tui.requestRender()
    }

    /** Start the frame timer. */
    private start(): void {
        this.interval = setInterval(() => {
            this.frame = (this.frame + 1) % FRAMES.length
            this.tui.requestRender()
        }, FRAME_INTERVAL_MS)
    }

    /** Stop the frame timer. */
    stop(): void {
        if (this.interval) {
            clearInterval(this.interval)
            this.interval = null
        }
    }

    /** Required by `Component`; no cached state to invalidate. */
    invalidate(): void {}

    /**
     * Render the spinner on a single row: `<frame> <message>`. No extra
     * vertical or horizontal padding so the row sits flush with the
     * surrounding scrollback.
     *
     * @param _width Ignored; the row is short enough to fit in any
     *   reasonable viewport.
     */
    render(_width: number): string[] {
        return [`${accentColor(FRAMES[this.frame])} ${mutedColor(this.message)}`]
    }
}

/**
 * Pick the glyph rendered after the loader stops. `"stop"` produces no
 * glyph — the spinner just disappears.
 *
 * @param conclusion Conclusion mode from the component definition.
 */
function conclusionPrefix(conclusion: SpinnerComponent["conclusion"]): string {
    switch (conclusion ?? "succeed") {
        case "succeed":
            return `${LOG_SYMBOLS.success} `
        case "fail":
            return `${LOG_SYMBOLS.failure} `
        case "stop":
            return ""
    }
}

/**
 * Mount a spinner on `ctx.tui`, cycle through the configured phrases over
 * `duration`, then replace the live row with a static line carrying the
 * conclusion glyph.
 *
 * @param component The spinner component definition.
 * @param ctx Shared execution context.
 */
export async function runSpinner(
    component: SpinnerComponent,
    ctx: ComponentContext
): Promise<void> {
    const phrases = (
        Array.isArray(component.output) ? component.output : [component.output]
    ).map((p) => interpolate(p, ctx.argv, ctx.variables))

    const totalMs = resolveDuration(component.duration)
    const spinner = new SpinnerLine(ctx.tui, phrases[0])
    ctx.tui.addChild(spinner)

    const sliceMs = totalMs / phrases.length
    for (let i = 0; i < phrases.length; i++) {
        if (i > 0) spinner.setMessage(phrases[i])
        await sleep(sliceMs)
    }

    spinner.stop()
    ctx.tui.removeChild(spinner)
    const finalLine = `${conclusionPrefix(component.conclusion)}${phrases[phrases.length - 1]}`
    ctx.tui.addChild(flatText(finalLine))
    ctx.tui.requestRender()
}
