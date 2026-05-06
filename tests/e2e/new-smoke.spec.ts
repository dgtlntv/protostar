/**
 * @file Pre-cutover smoke for the new pi-tui-based stack. Boots
 * `index-new.html` (the temporary entry running the new shell alongside the
 * legacy one) and verifies three things:
 *   1. The shell prompt renders.
 *   2. `logout` runs and prints its expected output.
 *   3. A second prompt appears once the command finishes.
 *
 * Catches integration-level breakage (vite config, polyfills, addon
 * wiring) before the 2.G cutover. Deleted along with `index-new.html` and
 * `src/index-new.ts` in 2.G.
 */

import { test, expect } from "@playwright/test"

const PROMPT = "user@ubuntu:~$"
const ROWS = ".xterm-rows"

/**
 * Read the visible text of the xterm rows container as a single string.
 *
 * @param page Playwright page.
 * @returns The container's textContent (or empty string).
 */
async function getRowsText(page: import("@playwright/test").Page): Promise<string> {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel)
        return el ? (el.textContent ?? "") : ""
    }, ROWS)
}

/**
 * Wait until the shell prompt is rendered into the xterm rows container.
 *
 * @param page Playwright page.
 * @param minOccurrences Minimum number of prompt occurrences to wait for.
 */
async function waitForPromptCount(
    page: import("@playwright/test").Page,
    minOccurrences: number
): Promise<void> {
    await page.waitForFunction(
        ({ prompt, sel, min }) => {
            const el = document.querySelector(sel)
            if (!el) return false
            const text = el.textContent ?? ""
            return text.split(prompt).length - 1 >= min
        },
        { prompt: PROMPT, sel: ROWS, min: minOccurrences },
        { timeout: 10_000 }
    )
}

test.describe("new shell smoke (index-new.html)", () => {
    test("prompt renders, logout runs, and a second prompt follows", async ({
        page,
    }) => {
        await page.goto("/index-new.html")
        await waitForPromptCount(page, 1)

        const initial = await getRowsText(page)
        expect(initial).toContain(PROMPT)

        await page.keyboard.type("logout")
        await page.keyboard.press("Enter")

        await page.waitForFunction(
            ({ sel, marker }) => {
                const el = document.querySelector(sel)
                return !!el && (el.textContent ?? "").includes(marker)
            },
            { sel: ROWS, marker: "You are not currently logged in." },
            { timeout: 10_000 }
        )

        await waitForPromptCount(page, 2)

        const finalText = await getRowsText(page)
        expect(finalText).toContain("You are not currently logged in.")
        expect(finalText.split(PROMPT).length - 1).toBeGreaterThanOrEqual(2)
    })
})
