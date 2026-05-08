import { expect, test } from "@playwright/test"
import { getBufferText, submit, type, waitForPrompt, PROMPT } from "./helpers/terminal"
import { expectCursor, expectInput, expectPrompt } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Enter on empty input advances to a new prompt row", async ({ page }) => {
    const beforeCount = (await getBufferText(page)).split(PROMPT).length - 1
    await submit(page)
    await expectInput(page, "")
    await expectCursor(page, 0)
    const afterCount = (await getBufferText(page)).split(PROMPT).length - 1
    expect(afterCount).toBeGreaterThan(beforeCount)
})

test("Enter on a valid command executes it and returns to a new prompt", async ({ page }) => {
    await type(page, "logout")
    await submit(page)
    const text = await getBufferText(page)
    expect(text).toContain("You are not currently logged in.")
    await expectPrompt(page)
    await expectInput(page, "")
})

test("Enter on an unknown command prints a yargs error and returns to a new prompt", async ({ page }) => {
    await type(page, "definitelynotacommand")
    await submit(page)
    const text = await getBufferText(page)
    expect(text.toLowerCase()).toMatch(/unknown|not.*command|command.*not/i)
    await expectPrompt(page)
    await expectInput(page, "")
})
