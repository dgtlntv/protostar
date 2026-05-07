import { test } from "@playwright/test"
import { press, waitForPrompt } from "./helpers/terminal"
import { expectCursor, expectInput, expectPrompt } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Function keys and PageUp/PageDown do not insert characters or corrupt the prompt", async ({
    page,
}) => {
    const keys = [
        "F1",
        "F2",
        "F3",
        "F4",
        "F5",
        "F6",
        "F7",
        "F8",
        "F9",
        "F10",
        "F11",
        "F12",
        "PageUp",
        "PageDown",
    ]
    for (const key of keys) {
        await press(page, key)
    }
    await expectInput(page, "")
    await expectCursor(page, 0)
    await expectPrompt(page)
})

test("Escape does not insert a literal control character", async ({ page }) => {
    await press(page, "Escape")
    await expectInput(page, "")
    await expectCursor(page, 0)
    await expectPrompt(page)
})
