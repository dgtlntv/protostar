/**
 * @file `basicAuth` prompt. Sequenced username + password inputs with the
 * resolved value being a boolean: `true` iff both fields match the
 * expected credentials.
 */

import type { BasicAuthComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { flatText } from "../../tui/theme.js"
import { persist, renderMessage, runInlinePrompt } from "./promptUtils.js"

/**
 * Run a username input followed by a password input (masked unless
 * `showPassword` is true). Resolves to `"true"` if both match the
 * expected credentials, `"false"` otherwise.
 *
 * @param component BasicAuth component definition.
 * @param ctx Shared execution context.
 */
export async function runBasicAuth(
    component: BasicAuthComponent,
    ctx: ComponentContext
): Promise<void> {
    const heading = renderMessage(component.message, ctx)
    ctx.tui.addChild(flatText(heading))
    ctx.tui.requestRender()

    const username = await runInlinePrompt({
        tui: ctx.tui,
        message: "Username:",
        signal: ctx.signal,
    })
    if (username === undefined) return

    const password = component.showPassword
        ? await runInlinePrompt({
              tui: ctx.tui,
              message: "Password:",
              signal: ctx.signal,
          })
        : await runInlinePrompt({
              tui: ctx.tui,
              message: "Password:",
              promptOptions: { mask: { kind: "mask", char: "•" } },
              renderAnswer: (v) => "•".repeat([...v].length),
              signal: ctx.signal,
          })
    if (password === undefined) return

    const ok =
        username === component.username && password === component.password
    persist(ctx.variables, component.name, String(ok))
}
