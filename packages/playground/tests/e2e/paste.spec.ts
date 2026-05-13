import { expect, test } from "@playwright/test"
import {
    getBufferText,
    paste,
    press,
    type,
    waitForPrompt,
    PROMPT,
} from "./helpers/terminal"
import { expectCursor, expectInput } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Single-line paste into empty input lands at the cursor and does not auto-submit", async ({
    page,
}) => {
    const before = (await getBufferText(page)).split(PROMPT).length - 1
    await paste(page, "hello")
    await expectInput(page, "hello")
    await expectCursor(page, 5)
    const after = (await getBufferText(page)).split(PROMPT).length - 1
    expect(after).toBe(before)
})

test("Paste in the middle of existing input lands at the cursor position", async ({ page }) => {
    await type(page, "abcd")
    for (let i = 0; i < 2; i++) await press(page, "ArrowLeft")
    await expectCursor(page, 2)
    await paste(page, "XXXX")
    await expectInput(page, "abXXXXcd")
    await expectCursor(page, 6)
})

// Every complete line in a multi-line paste should run as its own command.
// The paste path normalizes line endings, splits on `\n`, and dispatches each
// shell-complete chunk in order — leaving any trailing incomplete tail in the
// live buffer.
test(
    "Multi-line paste runs each complete line as a separate command",
    async ({ page }) => {
        await paste(page, "logout\nlogout\n")
        // Both dispatches happen sequentially; poll until the second one
        // has rendered. Reading the buffer too early (e.g. while the first
        // dispatch is still running) sees only one occurrence.
        await expect
            .poll(async () => {
                const text = await getBufferText(page)
                return text.split("You are not currently logged in.").length - 1
            })
            .toBe(2)
        await expectInput(page, "")
    }
)

test("Paste with \\r\\n line endings does not double-insert newlines", async ({ page }) => {
    // Unclosed quote keeps the read active so we can inspect the result.
    // Without normalization the \r\n would feed two terminator chars; the
    // helper collapses [\r\n]+ to a single \r so only one \n is inserted.
    await paste(page, "'a\r\nb'")
    await expectInput(page, "'a\nb'")
})

test("Paste with mixed \\n / \\r / \\r\\n line endings normalizes consistently", async ({
    page,
}) => {
    await paste(page, "'a\nb\rc\r\nd'")
    await expectInput(page, "'a\nb\nc\nd'")
})

// Pinned behavior (testing-strategy.md §11): when a pasted line is
// shell-incomplete, Enter on it inserts a literal '\n' rather than
// submitting, and subsequent pasted chars accumulate into the same input.
// The paste does NOT submit at the first newline.
test("Multi-line paste with an incomplete first line continues across the newline", async ({
    page,
}) => {
    const before = (await getBufferText(page)).split(PROMPT).length - 1
    await paste(page, 'echo "hi\nthere"')
    await expectInput(page, 'echo "hi\nthere"')
    // Read still pending — no new prompt was drawn.
    const after = (await getBufferText(page)).split(PROMPT).length - 1
    expect(after).toBe(before)
})
