import { expect, test, type Page } from "@playwright/test"
import { press, type, waitForPrompt } from "./helpers/terminal"
import { expectCursor, expectInput, expectPrompt } from "./helpers/assertions"

const PROMPT_WIDTH = "user@ubuntu:~$ ".length

// Resize tests start from a wide viewport and shrink. FitAddon recomputes on
// the window 'resize' event; we wait for `_termSize.cols` to actually change
// so assertions don't race the layout update.
test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto("/")
    await waitForPrompt(page)
})

async function getCols(page: Page): Promise<number> {
    return page.evaluate(() => window.__protostar.localEcho._termSize.cols)
}

async function resizeAndWait(
    page: Page,
    width: number,
    height: number
): Promise<void> {
    const before = await getCols(page)
    await page.setViewportSize({ width, height })
    await page.waitForFunction(
        (prev) => window.__protostar.localEcho._termSize.cols !== prev,
        before,
        { timeout: 5_000 }
    )
}

// Sometimes a configure-retry is helpful for layout-sensitive specs; the
// underlying logic should be deterministic, but we add a small buffer for
// font-metric variance across CI runners.
test.describe.configure({ retries: 2 })

test("Resize while input is empty leaves the prompt intact and editable", async ({ page }) => {
    await resizeAndWait(page, 700, 500)
    await expectPrompt(page)
    await expectInput(page, "")
    await expectCursor(page, 0)
    // Still editable.
    await type(page, "hi")
    await expectInput(page, "hi")
    await expectCursor(page, 2)
})

test("Resize with short single-line input preserves _input and _cursor", async ({ page }) => {
    await type(page, "hello world")
    // Move cursor mid-input so we can verify it survives the resize.
    for (let i = 0; i < 5; i++) await press(page, "ArrowLeft")
    await expectCursor(page, 6)

    await resizeAndWait(page, 700, 500)
    await expectInput(page, "hello world")
    await expectCursor(page, 6)
})

test("Resize while wrapped re-wraps cleanly and preserves cursor offset", async ({ page }) => {
    const colsBefore = await getCols(page)
    // Choose a length that's wrapped in the wide viewport AND will still be
    // wrapped (or at least valid) in the narrow viewport.
    const inputLength = colsBefore - PROMPT_WIDTH + 20
    const text = "a".repeat(inputLength)
    await type(page, text)
    await expectInput(page, text)
    await expectCursor(page, inputLength)

    await resizeAndWait(page, 600, 500)
    // _input is unchanged; cursor offset is unchanged.
    await expectInput(page, text)
    await expectCursor(page, inputLength)
    // After the resize, cols is smaller, so the input still wraps — no need
    // to assert a specific row count, just that the logical state survived.
    const colsAfter = await getCols(page)
    expect(colsAfter).toBeLessThan(colsBefore)
})

test("Resize during an active multi-line continuation preserves the input", async ({ page }) => {
    await type(page, 'echo "hi')
    await press(page, "Enter")
    await expectInput(page, 'echo "hi\n')
    await type(page, "there")
    await expectInput(page, 'echo "hi\nthere')
    await expectCursor(page, 14)

    await resizeAndWait(page, 700, 500)
    await expectInput(page, 'echo "hi\nthere')
    await expectCursor(page, 14)
    // Continuation can still be closed and submitted after the resize.
    await type(page, '"')
    await press(page, "Enter")
    // After successful submit the input clears and a fresh prompt appears.
    await expectInput(page, "")
})
