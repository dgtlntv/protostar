import type { Page } from "@playwright/test"
import "./types"

const PROMPT = "user@ubuntu:~$"

const SELECTORS = {
    /** Visible xterm row container; rendered text lives in here. */
    rows: ".xterm-rows",
    /** Hidden textarea xterm uses to capture keyboard + paste events. */
    helperTextarea: ".xterm-helper-textarea",
} as const

/**
 * Wait until LocalEchoController is active and the prompt banner has been
 * rendered into the xterm viewport.
 *
 * @param page - Playwright page driving the app.
 * @param timeout - Max ms to wait before failing.
 */
export async function waitForPrompt(page: Page, timeout = 10_000): Promise<void> {
    await page.waitForFunction(
        ({ prompt, rowsSel }) => {
            const handle = window.__protostar
            if (!handle) return false
            if (!handle.localEcho._active) return false
            const rows = document.querySelector(rowsSel)
            return !!rows && (rows.textContent ?? "").includes(prompt)
        },
        { prompt: PROMPT, rowsSel: SELECTORS.rows },
        { timeout }
    )
}

/**
 * Type `text` one character at a time. Each char reaches `handleTermData`
 * on its own and never trips the paste threshold (`data.length > 3`).
 *
 * @param page - Playwright page.
 * @param text - Literal text to type.
 */
export async function type(page: Page, text: string): Promise<void> {
    await page.keyboard.type(text)
}

/**
 * Dispatch a real `paste` DOM event on xterm's helper textarea. xterm.js
 * reads `clipboardData` and forwards it to `onData` as a single chunk —
 * the same path Cmd/Ctrl+V travels, so `handleTermData` takes its paste
 * branch.
 *
 * @param page - Playwright page.
 * @param text - Text to paste, including any newlines.
 */
export async function paste(page: Page, text: string): Promise<void> {
    await page.evaluate(
        ({ value, textareaSel }) => {
            const textarea = document.querySelector(textareaSel) as HTMLTextAreaElement | null
            if (!textarea) throw new Error(`xterm helper textarea not found: ${textareaSel}`)
            textarea.focus()
            const dt = new DataTransfer()
            dt.setData("text/plain", value)
            textarea.dispatchEvent(
                new ClipboardEvent("paste", {
                    clipboardData: dt,
                    bubbles: true,
                    cancelable: true,
                })
            )
        },
        { value: text, textareaSel: SELECTORS.helperTextarea }
    )
}

/**
 * Press a key, optionally with modifiers, via Playwright's keyboard API.
 *
 * @param page - Playwright page.
 * @param key - Playwright key name (e.g. "ArrowLeft", "Home", "a").
 * @param modifiers - Optional modifier keys to hold during the press.
 */
export async function press(
    page: Page,
    key: string,
    modifiers?: Array<"Shift" | "Control" | "Alt" | "Meta">
): Promise<void> {
    const combo = modifiers && modifiers.length ? `${modifiers.join("+")}+${key}` : key
    await page.keyboard.press(combo)
}

/**
 * Read the current logical input buffer from LocalEchoController.
 *
 * @param page - Playwright page.
 * @returns The value of `localEcho._input`.
 */
export async function getInput(page: Page): Promise<string> {
    return page.evaluate(() => window.__protostar.localEcho._input)
}

/**
 * Read the current cursor offset (within `_input`) from LocalEchoController.
 *
 * @param page - Playwright page.
 * @returns The value of `localEcho._cursor`.
 */
export async function getCursor(page: Page): Promise<number> {
    return page.evaluate(() => window.__protostar.localEcho._cursor)
}

/**
 * Read a single rendered line from xterm's active buffer.
 *
 * @param page - Playwright page.
 * @param y - Zero-based row index in the active buffer.
 * @returns The line's text, right-trimmed; empty string if the row is absent.
 */
export async function getBufferLine(page: Page, y: number): Promise<string> {
    return page.evaluate((row) => {
        const buffer = window.__protostar.term.buffer.active
        const line = buffer.getLine(row)
        return line ? line.translateToString(true) : ""
    }, y)
}

/**
 * Read the full rendered text of xterm's active buffer, joined by newlines
 * with trailing blank rows stripped.
 *
 * @param page - Playwright page.
 * @returns The buffer's visible text.
 */
export async function getBufferText(page: Page): Promise<string> {
    return page.evaluate(() => {
        const buffer = window.__protostar.term.buffer.active
        const lines: string[] = []
        for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i)
            if (line) lines.push(line.translateToString(true))
        }
        return lines.join("\n").replace(/\n+$/, "")
    })
}

/**
 * Press Enter and wait for the next prompt to be ready.
 *
 * @param page - Playwright page.
 */
export async function submit(page: Page): Promise<void> {
    await page.keyboard.press("Enter")
    await waitForPrompt(page)
}

/**
 * Send Ctrl+C and wait for the next prompt to be ready.
 *
 * @param page - Playwright page.
 */
export async function cancel(page: Page): Promise<void> {
    await page.keyboard.press("Control+c")
    await waitForPrompt(page)
}

export { PROMPT, SELECTORS }
