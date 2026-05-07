import { expect, test } from "@playwright/test"
import {
    cancel,
    getBufferText,
    press,
    submit,
    type,
    waitForPrompt,
    PROMPT,
} from "./helpers/terminal"
import { expectCursor, expectInput, expectPrompt } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Ctrl+C with a typed partial prints ^C, clears input, and reprompts", async ({ page }) => {
    await type(page, "partial")
    await cancel(page)
    const text = await getBufferText(page)
    expect(text).toContain("^C")
    await expectInput(page, "")
    await expectCursor(page, 0)
    await expectPrompt(page)
})

test("Ctrl+C on empty input prints ^C and reprompts", async ({ page }) => {
    const before = (await getBufferText(page)).split(PROMPT).length - 1
    await cancel(page)
    const text = await getBufferText(page)
    expect(text).toContain("^C")
    const after = text.split(PROMPT).length - 1
    expect(after).toBeGreaterThan(before)
    await expectInput(page, "")
    await expectCursor(page, 0)
})

test("Ctrl+C during multi-line continuation exits cleanly to a fresh prompt", async ({ page }) => {
    // Unclosed quote forces continuation rather than submission.
    await type(page, 'echo "hi')
    await press(page, "Enter")
    // We are now mid-continuation — verify the input has the literal newline.
    await expectInput(page, 'echo "hi\n')
    await cancel(page)
    await expectInput(page, "")
    await expectCursor(page, 0)
    await expectPrompt(page)
    // The terminal must accept fresh input after the cancel.
    await type(page, "logout")
    await submit(page)
    const text = await getBufferText(page)
    expect(text).toContain("You are not currently logged in.")
})

test("Cancelled input is not added to history", async ({ page }) => {
    await type(page, "kept")
    await submit(page)
    await type(page, "cancelled")
    await cancel(page)
    // Pressing Up should recall 'kept' — 'cancelled' was never pushed.
    await press(page, "ArrowUp")
    await expectInput(page, "kept")
    await press(page, "ArrowUp")
    await expectInput(page, "kept")
})
