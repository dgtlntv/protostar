import { expect, test, type Page } from "@playwright/test"
import { getCols, getInput, press, type, waitForPrompt } from "./helpers/terminal"
import { expectCursor, expectInput } from "./helpers/assertions"

const PROMPT_WIDTH = "user@ubuntu:~$ ".length // 15

// Use a fixed viewport so xterm derives a stable column count from FitAddon.
// The exact `cols` value still depends on font metrics, so each test reads
// it via `getCols(page)`.
test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto("/")
    await waitForPrompt(page)
})

async function getCursorXY(page: Page): Promise<{ x: number; y: number }> {
    return page.evaluate(() => {
        const buf = window.__protostar.term.buffer.active
        return { x: buf.cursorX, y: buf.cursorY }
    })
}

test.fixme("ArrowLeft across the wrap boundary lands on the last column of the previous visual row (BUG-005)", async ({
    page,
}) => {
    const cols = await getCols(page)
    // Type enough characters to wrap onto a second visual row.
    const inputLength = cols - PROMPT_WIDTH + 5
    const text = "a".repeat(inputLength)
    await type(page, text)
    await expectInput(page, text)

    // Step back to the wrap boundary itself (offset = cols - PROMPT_WIDTH,
    // i.e. visual col 0 of row 1).
    const boundary = cols - PROMPT_WIDTH
    for (let i = 0; i < inputLength - boundary; i++) {
        await press(page, "ArrowLeft")
    }
    await expectCursor(page, boundary)
    const before = await getCursorXY(page)
    expect(before.x).toBe(0)

    // Crossing the boundary: the cursor must reappear on the previous row
    // at the last column.
    await press(page, "ArrowLeft")
    await expectCursor(page, boundary - 1)
    const after = await getCursorXY(page)
    expect(after.y).toBe(before.y - 1)
    expect(after.x).toBe(cols - 1)
})

test("Inserting a character mid-input on a wrapped line keeps logical state correct", async ({
    page,
}) => {
    const cols = await getCols(page)
    const inputLength = cols - PROMPT_WIDTH + 10
    const text = "a".repeat(inputLength)
    await type(page, text)
    await expectInput(page, text)
    await expectCursor(page, inputLength)

    // Move to a clearly mid-input offset (well inside row 0 of the wrap).
    const target = Math.floor(inputLength / 2)
    for (let i = 0; i < inputLength - target; i++) {
        await press(page, "ArrowLeft")
    }
    await expectCursor(page, target)

    await type(page, "X")
    const expected = text.slice(0, target) + "X" + text.slice(target)
    await expectInput(page, expected)
    await expectCursor(page, target + 1)
    // Sanity: the trailing 'a's after the insertion point are still present.
    const tail = (await getInput(page)).slice(target + 1)
    expect(tail).toBe("a".repeat(inputLength - target))
})
