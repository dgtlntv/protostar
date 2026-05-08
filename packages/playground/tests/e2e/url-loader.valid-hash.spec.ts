/**
 * @file Integration test for the full encode-in-browser → decode-on-boot
 * pipeline. We boot a no-hash playground first, encode a synthetic
 * Commands through the dev-handle codec (the same code the prod boot
 * path runs), then navigate back to `/#${payload}` and assert the
 * synthetic config is what loads.
 *
 * Encoding through the in-page codec keeps the test free of a Node-side
 * codec build step and guarantees the bytes match what the real share
 * shortcut would produce.
 */

import { expect, test } from "@playwright/test"
import { waitForPrompt, getBufferText, type, submit } from "./helpers/terminal"
import "./helpers/types"

const SYNTHETIC_WELCOME = "Synthetic prototype loaded from URL hash."
const SYNTHETIC_COMMAND_OUTPUT = "Hello from a URL-loaded prototype."

const SYNTHETIC_COMMANDS = {
    welcome: SYNTHETIC_WELCOME,
    variables: {},
    commands: {
        greet: {
            description: "Print a greeting.",
            handler: { component: "text", output: SYNTHETIC_COMMAND_OUTPUT },
        },
    },
}

test("valid hash → decoded prototype loads instead of bundled demo", async ({
    page,
}) => {
    // First navigation boots the bundled demo so we can reach the
    // codec exposed on `window.__protostar`. Encoding inside the
    // browser eliminates any Node-vs-browser CompressionStream mismatch.
    await page.goto("/")
    await waitForPrompt(page)

    const payload = await page.evaluate(
        async (commands) => window.__protostar.codec.encode(commands),
        SYNTHETIC_COMMANDS
    )

    // Same-origin hash-only navigation is treated as a same-document
    // change by the browser, so `goto` alone doesn't refire the boot
    // path. Reload to force a fresh DOMContentLoaded with the new hash.
    await page.goto(`/#${payload}`)
    await page.reload()
    await waitForPrompt(page)

    const banner = await getBufferText(page)
    expect(banner).toContain(SYNTHETIC_WELCOME)
    expect(banner).not.toContain(
        "Welcome to TaskTrack CLI! Type 'help' to see available commands."
    )

    await type(page, "greet")
    await submit(page)

    const after = await getBufferText(page)
    expect(after).toContain(SYNTHETIC_COMMAND_OUTPUT)
})
