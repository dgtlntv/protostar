import { test } from "@playwright/test"
import { press, type, waitForPrompt } from "./helpers/terminal"
import { expectCursor, expectInput } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Left on empty input cannot cross into the prompt", async ({ page }) => {
    await press(page, "ArrowLeft")
    await expectInput(page, "")
    await expectCursor(page, 0)
})

test("Left beyond input start clamps at 0", async ({ page }) => {
    await type(page, "hello")
    for (let i = 0; i < 10; i++) await press(page, "ArrowLeft")
    await expectInput(page, "hello")
    await expectCursor(page, 0)
})

test("Home jumps cursor to input start", async ({ page }) => {
    await type(page, "hello")
    await press(page, "Home")
    await expectCursor(page, 0)
})

test("Right beyond input end clamps at input length", async ({ page }) => {
    await type(page, "hello")
    await press(page, "Home")
    for (let i = 0; i < 10; i++) await press(page, "ArrowRight")
    await expectInput(page, "hello")
    await expectCursor(page, 5)
})

test("End from mid-input lands at input end", async ({ page }) => {
    await type(page, "hello")
    await press(page, "ArrowLeft")
    await press(page, "ArrowLeft")
    await expectCursor(page, 3)
    await press(page, "End")
    await expectCursor(page, 5)
})
