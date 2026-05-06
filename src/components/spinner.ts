/**
 * @file `spinner` component. Wraps pi-tui's `Loader` to render an animated
 * loader with an optional array of phrases cycled across the duration, and
 * a final glyph (`✔`/`✖`/none) chosen by `component.conclusion`.
 */

import { Loader } from "@mariozechner/pi-tui"
import type { SpinnerComponent } from "../types/commands.js"
import { interpolate } from "../shell/interpolate.js"
import { LOG_SYMBOLS, accentColor, flatText, mutedColor } from "../tui/theme.js"
import type { ComponentContext } from "./context.js"
import { resolveDuration, sleep } from "./duration.js"

/**
 * Pick the glyph rendered after the loader stops. `"stop"` produces no
 * glyph — the spinner just disappears.
 *
 * @param conclusion Conclusion mode from the component definition.
 * @returns The leading glyph + space, or empty string for `"stop"`.
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
 * Mount a `Loader` on `ctx.tui`, cycle through the configured phrases over
 * `duration`, then replace the loader with a static line carrying the
 * conclusion glyph.
 *
 * @param component The spinner component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the spinner finishes.
 */
export async function runSpinner(
    component: SpinnerComponent,
    ctx: ComponentContext
): Promise<void> {
    const phrases = (
        Array.isArray(component.output) ? component.output : [component.output]
    ).map((p) => interpolate(p, ctx.argv, ctx.variables))

    const totalMs = resolveDuration(component.duration)
    const loader = new Loader(ctx.tui, accentColor, mutedColor, phrases[0])
    ctx.tui.addChild(loader)

    const sliceMs = totalMs / phrases.length
    for (let i = 0; i < phrases.length; i++) {
        if (i > 0) loader.setMessage(phrases[i])
        await sleep(sliceMs)
    }

    loader.stop()
    ctx.tui.removeChild(loader)
    const finalLine = `${conclusionPrefix(component.conclusion)}${phrases[phrases.length - 1]}`
    ctx.tui.addChild(flatText(finalLine))
    ctx.tui.requestRender()
}
