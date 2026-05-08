/**
 * @file Decode-failure path: a clearly-corrupted `#p1=…` payload must
 * surface a descriptive error in the terminal area and still boot the
 * bundled demo so the playground stays usable. Silent fallback would be
 * the worst UX for a recipient who clicked a broken share link.
 */

import { expect, test } from "@playwright/test"
import {
    waitForPrompt,
    getBufferText,
    type,
    submit,
} from "./helpers/terminal"
import { expectInput } from "./helpers/assertions"

const BUNDLED_WELCOME =
    "Welcome to TaskTrack CLI! Type 'help' to see available commands."

test("malformed hash → error rendered, bundled fallback is interactive", async ({
    page,
}) => {
    await page.goto("/#p1=garbage_payload_not_base64url_compressed")
    await waitForPrompt(page)

    const text = await getBufferText(page)
    expect(text).toContain("Could not load shared prototype")
    expect(text).toContain(BUNDLED_WELCOME)

    // The fallback prompt must accept input — the rendered error line
    // is purely informational and shouldn't break the read-eval loop.
    await type(page, "help")
    await expectInput(page, "help")
    await submit(page)
})
