/**
 * @file `text` component. Interpolates `output` against argv + variables
 * and mounts the result on the shared TUI as a pi-tui `Text` child.
 */

import type { TextComponent } from "../types/commands.js"
import { interpolate } from "../shell/interpolate.js"
import { flatText } from "../tui/theme.js"
import type { ComponentContext } from "./context.js"
import { resolveDuration, sleep } from "./duration.js"

/**
 * Render `component.output` (after `{{var}}` interpolation) as a pi-tui
 * `Text` child of `ctx.tui`. If `component.duration` is set, sleep the
 * configured amount before resolving — used by demos to insert a beat of
 * fake latency between lines.
 *
 * @param component The text component definition from `commands.json`.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the optional duration elapses.
 */
export async function runText(
    component: TextComponent,
    ctx: ComponentContext
): Promise<void> {
    const rendered = interpolate(component.output, ctx.argv, ctx.variables)
    ctx.tui.addChild(flatText(rendered))
    ctx.tui.requestRender()
    if (component.duration !== undefined) {
        await sleep(resolveDuration(component.duration), ctx.signal)
    }
}
