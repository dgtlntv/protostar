import { expect, type Page } from "@playwright/test"
import { getBufferText, getCursor, getInput, PROMPT } from "./terminal"

/**
 * Assert that the prompt banner is present somewhere in the rendered buffer.
 *
 * @param page - Playwright page.
 */
export async function expectPrompt(page: Page): Promise<void> {
    const text = await getBufferText(page)
    expect(text).toContain(PROMPT)
}

/**
 * Assert (with polling) that `localEcho._input` equals the given value.
 *
 * @param page - Playwright page.
 * @param value - Expected logical input string.
 */
export async function expectInput(page: Page, value: string): Promise<void> {
    await expect.poll(() => getInput(page)).toBe(value)
}

/**
 * Assert (with polling) that `localEcho._cursor` equals the given offset.
 *
 * @param page - Playwright page.
 * @param offset - Expected cursor offset within `_input`.
 */
export async function expectCursor(page: Page, offset: number): Promise<void> {
    await expect.poll(() => getCursor(page)).toBe(offset)
}
