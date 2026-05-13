/**
 * @file Share-link round-trip: Ctrl+Shift+L with the bundled demo loaded
 * must place a `${origin}${pathname}#p1=…` URL on the clipboard whose
 * payload decodes back to the same `commands.json` the playground was
 * showing. Closes the loop on the encoder/decoder pair from the user's
 * perspective: pressing the shortcut produces a URL the playground can
 * itself reload.
 */

import { expect, test } from "@playwright/test"
import { waitForPrompt, getBufferText } from "./helpers/terminal"

const BUNDLED_WELCOME =
    "Welcome to TaskTrack CLI! Type 'help' to see available commands."

const SHARE_URL_PATTERN = /^https?:\/\/[^/]+\/?#p1=[A-Za-z0-9_-]+$/

test.describe("share link shortcut", () => {
    test.use({ permissions: ["clipboard-read", "clipboard-write"] })

    test("Ctrl+Shift+L copies a URL whose payload decodes to the bundled commands", async ({
        page,
    }) => {
        await page.goto("/")
        await waitForPrompt(page)

        const before = await getBufferText(page)
        expect(before).toContain(BUNDLED_WELCOME)

        await page.keyboard.press("Control+Shift+L")

        // Confirmation lands in the terminal area asynchronously after
        // the encode + clipboard write resolve.
        await expect
            .poll(async () => getBufferText(page))
            .toContain("Share link copied to clipboard.")

        const clipboardUrl = await page.evaluate(() =>
            navigator.clipboard.readText()
        )
        expect(clipboardUrl).toMatch(SHARE_URL_PATTERN)

        // Strip everything before `#` and feed the fragment back through
        // decode — the payload must round-trip to a Commands whose
        // welcome matches the bundled demo.
        const payload = clipboardUrl.slice(clipboardUrl.indexOf("#") + 1)
        const result = await page.evaluate(
            async (input) => window.__protostar.codec.decode(input),
            payload
        )
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(
                (result.commands as { welcome: string }).welcome
            ).toBe(BUNDLED_WELCOME)
        }
    })
})
