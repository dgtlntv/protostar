/**
 * @file Regression coverage for the no-hash boot path: the playground
 * must continue to load the bundled `commands.json` unchanged when the
 * URL has no fragment. This is the path every existing e2e spec depends
 * on, so a regression here fans out into the rest of the suite.
 */

import { test } from "@playwright/test"
import { waitForPrompt } from "./helpers/terminal"
import { expectPrompt } from "./helpers/assertions"
import { expect } from "@playwright/test"
import { getBufferText } from "./helpers/terminal"

const BUNDLED_WELCOME =
    "Welcome to TaskTrack CLI! Type 'help' to see available commands."

test("no hash → bundled welcome banner renders, prompt is live", async ({
    page,
}) => {
    await page.goto("/")
    await waitForPrompt(page)

    const text = await getBufferText(page)
    expect(text).toContain(BUNDLED_WELCOME)
    await expectPrompt(page)
})
