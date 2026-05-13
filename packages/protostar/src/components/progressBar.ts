/**
 * @file `progressBar` component. Renders an animated bar that fills over a
 * configured duration, with jittered step sizes (60% normal, 40% burst,
 * 0–80 ms gap between updates) so the bar advances unevenly rather than
 * smoothly.
 */

import type { Component, TUI } from "@earendil-works/pi-tui"
import type { ProgressBarComponent } from "../types/commands.js"
import { interpolate } from "../shell/interpolate.js"
import { accentColor } from "../tui/theme.js"
import type { ComponentContext } from "./context.js"
import { resolveDuration, sleep } from "./duration.js"

/** Width of the rendered bar, in cells. */
const BAR_WIDTH = 40

/** Total update steps the bar progresses through over its duration. */
const TOTAL_STEPS = 200

/** Glyph used for the filled portion of the bar (U+2588). */
const FILLED_CHAR = "█"

/** Glyph used for the empty portion of the bar (U+2591). */
const EMPTY_CHAR = "░"

/**
 * pi-tui Component that renders one progress-bar line. State (`progress`,
 * `etaSeconds`) is mutated externally; the component re-renders the next
 * time the TUI loop runs.
 */
class ProgressBarComponentImpl implements Component {
    private progress = 0
    private etaSeconds = 0

    /** @param label Pre-interpolated label that precedes the bar. */
    constructor(private readonly label: string) {}

    /** Update the bar's filled fraction. @param value Value in [0, 1]. */
    setProgress(value: number): void {
        this.progress = Math.max(0, Math.min(1, value))
    }

    /** Update the displayed ETA. @param seconds Seconds remaining. */
    setEta(seconds: number): void {
        this.etaSeconds = Math.max(0, Math.floor(seconds))
    }

    /** Required by pi-tui's `Component`; this component caches nothing. */
    invalidate(): void {}

    /**
     * Render the bar onto a single line. Width is unused — the bar size is
     * fixed to {@link BAR_WIDTH}.
     *
     * @param _width Ignored.
     * @returns One-element line array.
     */
    render(_width: number): string[] {
        const filledCells = Math.round(this.progress * BAR_WIDTH)
        const bar =
            FILLED_CHAR.repeat(filledCells) +
            EMPTY_CHAR.repeat(BAR_WIDTH - filledCells)
        const percent = Math.floor(this.progress * 100)
        return [
            `${this.label} | ${accentColor(bar)} | ${percent}% | ETA: ${this.etaSeconds}s`,
        ]
    }
}

/**
 * Drive a {@link ProgressBarComponentImpl} from 0 to 100% over `duration`
 * milliseconds. Step durations are jittered (60% normal, 40% burst) with a
 * 0–80 ms gap between updates so the bar advances unevenly. The inter-step
 * pause uses {@link sleep} so an aborting `signal` returns from each await
 * immediately; the loop checks `signal.aborted` and exits.
 *
 * @param bar The pi-tui component being animated.
 * @param tui Owning TUI used to request re-renders.
 * @param duration Total animation budget in ms.
 * @param signal Optional cancel signal.
 * @returns A promise that resolves when the animation finishes or aborts.
 */
async function animate(
    bar: ProgressBarComponentImpl,
    tui: TUI,
    duration: number,
    signal?: AbortSignal
): Promise<void> {
    let elapsed = 0
    const avgStepMs = duration / TOTAL_STEPS
    while (!signal?.aborted) {
        const jitter =
            Math.random() < 0.6
                ? Math.random() * 0.5 + 0.1
                : Math.random() * 2 + 2
        const stepMs = Math.max(10, Math.floor(avgStepMs * jitter))
        elapsed += stepMs
        const ratio = Math.min(1, elapsed / duration)
        bar.setProgress(ratio)
        bar.setEta(Math.max(0, (duration - elapsed) / 1000))
        tui.requestRender()
        if (ratio >= 1) return
        await sleep(Math.random() * 80, signal)
    }
}

/**
 * Mount a progress bar onto `ctx.tui` and resolve once it reaches 100%.
 *
 * @param component The progressBar component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves when the animation completes.
 */
export async function runProgressBar(
    component: ProgressBarComponent,
    ctx: ComponentContext
): Promise<void> {
    const label = interpolate(component.output, ctx.argv, ctx.variables)
    const bar = new ProgressBarComponentImpl(label)
    ctx.tui.addChild(bar)
    ctx.tui.requestRender()
    await animate(bar, ctx.tui, resolveDuration(component.duration), ctx.signal)
    if (ctx.signal?.aborted) {
        ctx.tui.removeChild(bar)
        ctx.tui.requestRender()
    }
}
