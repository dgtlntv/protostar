import { test } from "@playwright/test"
import { waitForPrompt } from "./helpers/terminal"
import { expectCursor, expectInput, expectPrompt } from "./helpers/assertions"

test("terminal boots, exposes the handle, and renders the prompt", async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)

    await expectPrompt(page)
    await expectInput(page, "")
    await expectCursor(page, 0)
})
