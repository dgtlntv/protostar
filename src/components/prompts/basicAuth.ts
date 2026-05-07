/**
 * @file `basicAuth` prompt. Sequenced username + password inputs with the
 * resolved value being a boolean: `true` iff both fields match the
 * expected credentials.
 */

import type { BasicAuthComponent } from "../../types/commands.js"
import type { ComponentContext } from "../context.js"
import { flatText } from "../../tui/theme.js"
import { MaskedInput } from "./MaskedInput.js"
import {
    awaitInputLine,
    persist,
    renderMessage,
    runInline,
} from "./promptUtils.js"

/**
 * Run a username input followed by a password input (masked unless
 * `showPassword` is true). Resolves to `"true"` if both match the
 * expected credentials, `"false"` otherwise.
 *
 * @param component BasicAuth component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once both fields are submitted or the
 *   user cancels.
 */
export async function runBasicAuth(
    component: BasicAuthComponent,
    ctx: ComponentContext
): Promise<void> {
    const heading = renderMessage(component.message, ctx)
    ctx.tui.addChild(flatText(heading))
    ctx.tui.requestRender()

    const username = await awaitInputLine(ctx.tui, "Username:")
    if (username === undefined) return

    let password: string | undefined
    if (component.showPassword) {
        password = await awaitInputLine(ctx.tui, "Password:")
    } else {
        const body = new MaskedInput({ kind: "mask", char: "•" })
        password = await runInline<string>(
            ctx.tui,
            "Password:",
            body,
            (done) => {
                body.onSubmit = (v) => done(v, "•".repeat(v.length))
                body.onEscape = () => done(undefined, null)
            }
        )
    }
    if (password === undefined) return

    const ok =
        username === component.username && password === component.password
    persist(ctx.variables, component.name, String(ok))
}
