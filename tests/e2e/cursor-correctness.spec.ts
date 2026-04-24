import { test } from "@playwright/test"
import { press, type, waitForPrompt } from "./helpers/terminal"
import { expectCursor, expectInput } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Inserting mid-input with ArrowLeft places the character correctly", async ({ page }) => {
    await type(page, "hello")
    await press(page, "ArrowLeft")
    await press(page, "ArrowLeft")
    await type(page, "X")
    await expectInput(page, "helXlo")
    await expectCursor(page, 4)
})

test("Inserting at Home prepends the character", async ({ page }) => {
    await type(page, "hello")
    await press(page, "Home")
    await type(page, "X")
    await expectInput(page, "Xhello")
    await expectCursor(page, 1)
})

test.fixme(
    "Alt+Left from end of 'hello world' lands at the start of 'world' (BUG-001)",
    async ({ page }) => {
        await type(page, "hello world")
        await press(page, "ArrowLeft", ["Alt"])
        await expectCursor(page, 6)
    }
)

test.fixme(
    "Alt+Left then insert produces 'hello Xworld' (BUG-001)",
    async ({ page }) => {
        await type(page, "hello world")
        await press(page, "ArrowLeft", ["Alt"])
        await type(page, "X")
        await expectInput(page, "hello Xworld")
        await expectCursor(page, 7)
    }
)

test.fixme(
    "Alt+Right from input start lands at the end of 'hello' (BUG-001)",
    async ({ page }) => {
        await type(page, "hello world")
        await press(page, "Home")
        await press(page, "ArrowRight", ["Alt"])
        await expectCursor(page, 5)
    }
)
