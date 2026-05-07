import { test } from "@playwright/test"
import { press, type, waitForPrompt } from "./helpers/terminal"
import { expectCursor, expectInput } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Backspace mid-input removes the char before the cursor", async ({ page }) => {
    await type(page, "hello")
    await press(page, "ArrowLeft")
    await press(page, "ArrowLeft")
    await press(page, "Backspace")
    await expectInput(page, "helo")
    await expectCursor(page, 2)
})

test("Delete at Home removes the first char", async ({ page }) => {
    await type(page, "hello")
    await press(page, "Home")
    await press(page, "Delete")
    await expectInput(page, "ello")
    await expectCursor(page, 0)
})

test("Delete mid-input removes the char at the cursor", async ({ page }) => {
    await type(page, "hello")
    await press(page, "ArrowLeft")
    await press(page, "ArrowLeft")
    await press(page, "Delete")
    await expectInput(page, "helo")
    await expectCursor(page, 3)
})

test("Delete at End is a no-op", async ({ page }) => {
    await type(page, "hello")
    await press(page, "End")
    await press(page, "Delete")
    await expectInput(page, "hello")
    await expectCursor(page, 5)
})

test(
    "Ctrl+Backspace at end of 'hello world ' deletes back to the previous word boundary",
    async ({ page }) => {
        await type(page, "hello world ")
        await press(page, "Backspace", ["Control"])
        await expectInput(page, "hello ")
        await expectCursor(page, 6)
    }
)
