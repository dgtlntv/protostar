import { expect, test } from "@playwright/test"
import {
    getBufferText,
    press,
    submit,
    type,
    waitForPrompt,
    PROMPT,
} from "./helpers/terminal"
import { expectInput } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

test("Enter on input with an unclosed double quote starts a continuation", async ({ page }) => {
    const before = (await getBufferText(page)).split(PROMPT).length - 1
    await type(page, 'echo "hi')
    await press(page, "Enter")
    await expectInput(page, 'echo "hi\n')
    // No new top-level prompt was drawn — Enter was absorbed as a newline,
    // not a submission.
    const after = (await getBufferText(page)).split(PROMPT).length - 1
    expect(after).toBe(before)
})

test("Continuation submits cleanly once the quote is closed", async ({ page }) => {
    await type(page, 'echo "hi')
    await press(page, "Enter")
    await type(page, 'there"')
    await submit(page)
    // History push puts the whole multi-line input in one entry; ArrowUp
    // recalls it verbatim.
    await press(page, "ArrowUp")
    await expectInput(page, 'echo "hi\nthere"')
})

test("Trailing && triggers continuation", async ({ page }) => {
    const before = (await getBufferText(page)).split(PROMPT).length - 1
    await type(page, "echo hi &&")
    await press(page, "Enter")
    await expectInput(page, "echo hi &&\n")
    const after = (await getBufferText(page)).split(PROMPT).length - 1
    expect(after).toBe(before)
})

test("Trailing || triggers continuation", async ({ page }) => {
    const before = (await getBufferText(page)).split(PROMPT).length - 1
    await type(page, "echo hi ||")
    await press(page, "Enter")
    await expectInput(page, "echo hi ||\n")
    const after = (await getBufferText(page)).split(PROMPT).length - 1
    expect(after).toBe(before)
})

test("Trailing | triggers continuation", async ({ page }) => {
    const before = (await getBufferText(page)).split(PROMPT).length - 1
    await type(page, "echo hi |")
    await press(page, "Enter")
    await expectInput(page, "echo hi |\n")
    const after = (await getBufferText(page)).split(PROMPT).length - 1
    expect(after).toBe(before)
})

test("Single trailing backslash triggers continuation", async ({ page }) => {
    const before = (await getBufferText(page)).split(PROMPT).length - 1
    await type(page, "echo hi \\")
    await press(page, "Enter")
    await expectInput(page, "echo hi \\\n")
    const after = (await getBufferText(page)).split(PROMPT).length - 1
    expect(after).toBe(before)
})

test.fixme(
    'Escaped quote within a string still submits (BUG-004)',
    async ({ page }) => {
        await type(page, 'echo "it\\"s"')
        await submit(page)
        // Submission via prompt count: should advance past the input.
        const text = await getBufferText(page)
        expect(text.split(PROMPT).length - 1).toBeGreaterThan(1)
    }
)

test("Up after submitting a multi-line command recalls the whole input intact", async ({
    page,
}) => {
    await type(page, "'a")
    await press(page, "Enter")
    await type(page, "b'")
    await submit(page)
    await press(page, "ArrowUp")
    await expectInput(page, "'a\nb'")
})
