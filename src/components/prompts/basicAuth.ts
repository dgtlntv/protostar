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

    const username = await runInlinePrompt(ctx.tui, "Username:")
    if (username === undefined) return

    const password = component.showPassword
        ? await runInlinePrompt(ctx.tui, "Password:")
        : await runInlinePrompt(
              ctx.tui,
              "Password:",
              { mask: { kind: "mask", char: "•" } },
              (v) => "•".repeat([...v].length)
          )
    if (password === undefined) return

    const ok =
        username === component.username && password === component.password
    persist(ctx.variables, component.name, String(ok))
}
