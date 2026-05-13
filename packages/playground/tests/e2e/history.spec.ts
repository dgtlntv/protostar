import { expect, test } from "@playwright/test"
import { cancel, getBufferText, press, submit, type, waitForPrompt } from "./helpers/terminal"
import { expectInput } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Up after two submits recalls the most recent command", async ({ page }) => {
    await type(page, "cmd1")
    await submit(page)
    await type(page, "cmd2")
    await submit(page)
    await press(page, "ArrowUp")
    await expectInput(page, "cmd2")
})

test("Up twice walks back to the older command", async ({ page }) => {
    await type(page, "cmd1")
    await submit(page)
    await type(page, "cmd2")
    await submit(page)
    await press(page, "ArrowUp")
    await press(page, "ArrowUp")
    await expectInput(page, "cmd1")
})

test("Up at the oldest entry stays on the oldest entry", async ({ page }) => {
    await type(page, "cmd1")
    await submit(page)
    await type(page, "cmd2")
    await submit(page)
    await press(page, "ArrowUp")
    await press(page, "ArrowUp")
    await press(page, "ArrowUp")
    await expectInput(page, "cmd1")
})

test("Down walks forward to the newer entry", async ({ page }) => {
    await type(page, "cmd1")
    await submit(page)
    await type(page, "cmd2")
    await submit(page)
    await press(page, "ArrowUp")
    await press(page, "ArrowUp")
    await press(page, "ArrowDown")
    await expectInput(page, "cmd2")
})

test("Down past the newest entry leaves the input blank", async ({ page }) => {
    await type(page, "cmd1")
    await submit(page)
    await type(page, "cmd2")
    await submit(page)
    await press(page, "ArrowUp")
    await press(page, "ArrowDown")
    await expectInput(page, "")
})

// Pinned behavior (testing-strategy.md §5): pressing Up with a typed partial
// REPLACES the partial with the most recent history entry — protostar does
// not preserve unsubmitted text across history navigation.
test("Up with a typed partial replaces the partial with the last history entry", async ({
    page,
}) => {
    await type(page, "cmd1")
    await submit(page)
    await type(page, "par")
    await press(page, "ArrowUp")
    await expectInput(page, "cmd1")
})

test(
    "Ring buffer drops the oldest entries once size is exceeded",
    async ({ page }) => {
        for (let i = 1; i <= 12; i++) {
            await type(page, `cmd${i}`)
            await submit(page)
        }
        // Walk back as far as possible — should land on cmd3, not cmd1.
        for (let i = 0; i < 20; i++) {
            await press(page, "ArrowUp")
        }
        await expectInput(page, "cmd3")
    }
)

test("Consecutive duplicates dedupe; non-consecutive duplicates are kept", async ({ page }) => {
    await type(page, "dup")
    await submit(page)
    await type(page, "dup")
    await submit(page)
    // Only one entry: a single Up reaches it, a second Up has nowhere to go.
    await press(page, "ArrowUp")
    await expectInput(page, "dup")
    await press(page, "ArrowUp")
    await expectInput(page, "dup")

    // Reset to an empty prompt before the next phase so Down navigation has
    // a clean baseline.
    await cancel(page)

    await type(page, "other")
    await submit(page)
    await type(page, "dup")
    await submit(page)
    // Three entries now: dup, other, dup. Walk all the way back.
    await press(page, "ArrowUp")
    await expectInput(page, "dup")
    await press(page, "ArrowUp")
    await expectInput(page, "other")
    await press(page, "ArrowUp")
    await expectInput(page, "dup")
})

// Pinned behavior (testing-strategy.md §5): Ctrl+C clears the partial without
// pushing it to history and calls history.rewind(), so the next Up returns
// the most recent SUBMITTED command — never the cancelled partial.
test("Ctrl+C followed by Up does not recall the cancelled partial", async ({ page }) => {
    await type(page, "saved")
    await submit(page)
    await type(page, "partial")
    await cancel(page)
    await press(page, "ArrowUp")
    await expectInput(page, "saved")
    // Belt-and-braces: confirm 'partial' is not anywhere in the history list.
    const text = await getBufferText(page)
    expect(text).not.toMatch(/^partial$/m)
})
