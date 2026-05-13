import { expect, test, type Page } from "@playwright/test"
import {
    cancel,
    getBufferText,
    submit,
    type,
    waitForPrompt,
} from "./helpers/terminal"
import { expectCursor, expectInput, expectPrompt } from "./helpers/assertions"

test.beforeEach(async ({ page }) => {
    await page.goto("/")
    await waitForPrompt(page)
})

/**
 * Wait until the rendered buffer contains `needle`. Used between inline
 * prompts where the standard `submit()` helper (which waits for a fresh
 * PS1) would block, since inline prompts don't render PS1.
 */
async function waitForBufferText(page: Page, needle: string): Promise<void> {
    await page.waitForFunction(
        (n) => {
            const buf = window.__protostar.term.buffer.active
            for (let i = 0; i < buf.length; i++) {
                if ((buf.getLine(i)?.translateToString(true) ?? "").includes(n))
                    return true
            }
            return false
        },
        needle,
        { timeout: 10_000 }
    )
}

/** Press Enter without waiting for PS1 — used to advance inline prompts. */
async function pressEnter(page: Page): Promise<void> {
    await page.keyboard.press("Enter")
}

test("Ctrl+C during an input prompt prints ^C, snapshots the partial answer, and reprompts", async ({ page }) => {
    await type(page, "login")
    await pressEnter(page)
    await waitForBufferText(page, "Enter your username:")
    await type(page, "alice")
    await cancel(page)

    const text = await getBufferText(page)
    // The prompt's snapshot survives in scrollback with the typed buffer.
    expect(text).toContain("Enter your username:")
    expect(text).toContain("alice")
    // ^C appears below the snapshot.
    expect(text).toContain("^C")
    // No success checkmark — the prompt did not resolve.
    expect(text).not.toContain("Welcome,")
    // Fresh PS1 is mounted and editable.
    await expectInput(page, "")
    await expectCursor(page, 0)
    await expectPrompt(page)
})

test("Ctrl+C during a spinner prints ^C and abandons the rest of the handler list", async ({ page }) => {
    // Drive the login handler all the way to its 2 s spinner, then cancel
    // before the spinner concludes — the post-spinner `text` component
    // (which prints "Welcome, …") must never run.
    await type(page, "login")
    await pressEnter(page)
    await waitForBufferText(page, "Enter your username:")
    await type(page, "alice")
    await pressEnter(page)
    await waitForBufferText(page, "Enter your password:")
    await type(page, "secret")
    await pressEnter(page)

    // Wait for the spinner to start rendering before cancelling.
    await page.waitForFunction(() => {
        const buf = window.__protostar.term.buffer.active
        for (let i = 0; i < buf.length; i++) {
            const text = buf.getLine(i)?.translateToString(true) ?? ""
            if (
                text.includes("Logging in") ||
                text.includes("Please wait") ||
                text.includes("Verifying")
            )
                return true
        }
        return false
    })

    await cancel(page)

    const text = await getBufferText(page)
    expect(text).toContain("^C")
    // The post-spinner success text must not have rendered.
    expect(text).not.toContain("Welcome, alice")
    // No spinner conclusion glyph attached to the final phrase.
    expect(text).not.toContain("✔ Verifying credentials")
    // Fresh prompt is back.
    await expectInput(page, "")
    await expectCursor(page, 0)
    await expectPrompt(page)
})

test("after Ctrl+C cancels a running command, the next command runs cleanly", async ({ page }) => {
    await type(page, "login")
    await pressEnter(page)
    await waitForBufferText(page, "Enter your username:")
    await type(page, "alice")
    await cancel(page)

    // Issue a new command — the shell must dispatch it like any other.
    await type(page, "logout")
    await submit(page)

    const text = await getBufferText(page)
    expect(text).toContain("You are not currently logged in.")
})
