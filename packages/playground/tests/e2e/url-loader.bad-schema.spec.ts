/**
 * @file Schema-rejection path: a well-formed `#p1=…` payload whose
 * decoded JSON does not match the `commands.schema.json` must surface
 * an error that names the failing field, then fall back to the bundled
 * demo. We bypass the codec's `encode` (which validates first) and
 * compose the payload from the raw `compress` + `bytesToBase64url`
 * primitives so the resulting hash is structurally valid yet
 * semantically rejected.
 */

import { expect, test } from "@playwright/test"
import { waitForPrompt, getBufferText } from "./helpers/terminal"

const BUNDLED_WELCOME =
    "Welcome to TaskTrack CLI! Type 'help' to see available commands."

test("schema-invalid payload → validate error rendered, bundled fallback runs", async ({
    page,
}) => {
    await page.goto("/")
    await waitForPrompt(page)

    const payload = await page.evaluate(async () => {
        // Well-formed JSON but `commands` must be an object per schema.
        const json = JSON.stringify({
            welcome: "broken",
            variables: {},
            commands: "not an object",
        })
        const compressed = await window.__protostar.codec.compressDeflateRaw(
            json
        )
        const body = window.__protostar.codec.bytesToBase64url(compressed)
        return `p1=${body}`
    })

    // Same-origin hash-only navigation is treated as a same-document
    // change by the browser, so `goto` alone doesn't refire the boot
    // path. Reload to force a fresh DOMContentLoaded with the new hash.
    await page.goto(`/#${payload}`)
    await page.reload()
    await waitForPrompt(page)

    const text = await getBufferText(page)
    expect(text).toContain("Could not load shared prototype")
    // Error must identify the validation stage so the user knows the
    // payload decoded fine but the shape was wrong.
    expect(text).toContain("validate:")
    expect(text).toContain(BUNDLED_WELCOME)
})
