import { test } from "@playwright/test"
import { press, type, waitForPrompt } from "./helpers/terminal"
import { expectCursor, expectInput, expectPrompt } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Backspace on empty input is a no-op", async ({ page }) => {
    await press(page, "Backspace")
    await expectPrompt(page)
    await expectInput(page, "")
    await expectCursor(page, 0)
})

test("Backspace spammed on empty input leaves prompt intact", async ({ page }) => {
    for (let i = 0; i < 20; i++) await press(page, "Backspace")
    await expectPrompt(page)
    await expectInput(page, "")
    await expectCursor(page, 0)
})

test("Typing then Backspacing past input start stops at start", async ({ page }) => {
    await type(page, "abc")
    await expectInput(page, "abc")
    for (let i = 0; i < 5; i++) await press(page, "Backspace")
    await expectPrompt(page)
    await expectInput(page, "")
    await expectCursor(page, 0)
})

test("Delete on empty input is a no-op", async ({ page }) => {
    await press(page, "Delete")
    await expectPrompt(page)
    await expectInput(page, "")
    await expectCursor(page, 0)
})
