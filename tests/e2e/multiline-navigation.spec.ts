import { test, type Page } from "@playwright/test"
import { press, type, waitForPrompt } from "./helpers/terminal"
import { expectCursor, expectInput } from "./helpers/assertions"

// Build a known two-line input by exploiting the unclosed-single-quote
// continuation. Resulting state: _input = "'a\nb'" (5 chars), cursor = 5.
//
//   index 0  1  2   3  4
//   char  '  a  \n  b  '
//
// "End of line 1" is offset 2 (the \n), "col 0 of line 2" is offset 3.
async function buildTwoLineInput(page: Page): Promise<void> {
    await type(page, "'a")
    await press(page, "Enter")
    await type(page, "b'")
    await expectInput(page, "'a\nb'")
    await expectCursor(page, 5)
}

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Left at column 0 of line 2 lands on the newline (end of line 1)", async ({ page }) => {
    await buildTwoLineInput(page)
    // Move from end (5) back to col 0 of line 2 (3).
    await press(page, "ArrowLeft")
    await press(page, "ArrowLeft")
    await expectCursor(page, 3)
    await press(page, "ArrowLeft")
    await expectCursor(page, 2)
})

test("Right at end of line 1 lands at column 0 of line 2", async ({ page }) => {
    await buildTwoLineInput(page)
    // From end (5), step back to offset 2 (end of line 1).
    for (let i = 0; i < 3; i++) await press(page, "ArrowLeft")
    await expectCursor(page, 2)
    await press(page, "ArrowRight")
    await expectCursor(page, 3)
})

test("Typing mid-line on line 2 inserts at the correct offset", async ({ page }) => {
    await buildTwoLineInput(page)
    // Move to between 'b' and the closing quote — offset 4.
    await press(page, "ArrowLeft")
    await expectCursor(page, 4)
    await type(page, "X")
    await expectInput(page, "'a\nbX'")
    await expectCursor(page, 5)
})

test("Backspace at column 0 of line 2 removes the newline and joins the lines", async ({
    page,
}) => {
    await buildTwoLineInput(page)
    for (let i = 0; i < 2; i++) await press(page, "ArrowLeft")
    await expectCursor(page, 3)
    await press(page, "Backspace")
    await expectInput(page, "'ab'")
    await expectCursor(page, 2)
})

// Pinned behavior (testing-strategy.md §7): Home and End operate on the
// whole-input bounds, not the current visual line. setCursor(0) / setCursor
// (_input.length) ignore the newline offset entirely.
test("Home and End on multi-line input go to whole-input bounds, not visual-line bounds", async ({
    page,
}) => {
    await buildTwoLineInput(page)
    // Cursor starts at end of input.
    await expectCursor(page, 5)
    await press(page, "Home")
    await expectCursor(page, 0)
    await press(page, "End")
    await expectCursor(page, 5)

    // From the middle of line 2, Home still jumps to absolute 0 (not col 0
    // of line 2 = offset 3) and End still jumps to absolute 5.
    await press(page, "ArrowLeft")
    await expectCursor(page, 4)
    await press(page, "Home")
    await expectCursor(page, 0)
    await press(page, "End")
    await expectCursor(page, 5)
})
