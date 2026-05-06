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
 * Wait until the shell loop is idle (a prompt is mounted) and the prompt
 * banner has been rendered into the xterm viewport.
 *
 * @param page - Playwright page driving the app.
 * @param timeout - Max ms to wait before failing.
 */
export async function waitForPrompt(page: Page, timeout = 10_000): Promise<void> {
    await page.waitForFunction(
        ({ prompt, rowsSel }) => {
            const handle = window.__protostar
            if (!handle) return false
            if (!handle.shell.currentPrompt) return false
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
 * Read the current logical input buffer from the live PromptLine. Returns
 * the empty string while a command is running (no prompt mounted), which
 * matches the legacy `_input` semantics during dispatch.
 *
 * @param page - Playwright page.
 * @returns Editable buffer of the live PromptLine.
 */
export async function getInput(page: Page): Promise<string> {
    return page.evaluate(() => {
        const shell = window.__protostar.shell
        const prompt = shell.currentPrompt
        const live = prompt ? prompt.getValue() : ""
        // During a continuation, the legacy `_input` carried the entire
        // multi-line buffer. The new shell stores already-submitted lines in
        // `pendingInput` and edits the next line through the live PromptLine;
        // join them so callers see the same flat string.
        return shell.pendingInput
            ? shell.pendingInput + "\n" + live
            : live
    })
}

/**
 * Read the cursor offset within the live PromptLine's editable buffer.
 * Returns 0 while a command is running.
 *
 * @param page - Playwright page.
 * @returns Cursor offset of the live PromptLine.
 */
export async function getCursor(page: Page): Promise<number> {
    return page.evaluate(() => {
        const prompt = window.__protostar.shell.currentPrompt
        return prompt ? prompt.getCursor() : 0
    })
}

/**
 * Read the live column count off the xterm.js Terminal. Specs that need to
 * wait for a resize to settle, or that compute prompt-relative offsets, go
 * through this helper instead of poking at the terminal handle directly.
 *
 * @param page - Playwright page.
 * @returns Active column count.
 */
export async function getCols(page: Page): Promise<number> {
    return page.evaluate(() => window.__protostar.term.cols)
}

/**
 * Read the live row count off the xterm.js Terminal.
 *
 * @param page - Playwright page.
 * @returns Active row count.
 */
export async function getRows(page: Page): Promise<number> {
    return page.evaluate(() => window.__protostar.term.rows)
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
 * Count how many times the prompt banner currently appears anywhere in the
 * xterm buffer (scrollback included). Used as a snapshot before submit/cancel
 * so we can detect when a brand-new prompt line has been drawn below the
 * submitted input.
 *
 * Reading from the buffer rather than `.xterm-rows` matters: a command whose
 * output is taller than the viewport pushes earlier prompts out of the
 * rendered rows, and a viewport-only count would go down even though more
 * prompts have actually been written.
 *
 * @param page - Playwright page.
 * @returns The number of prompt occurrences in the buffer.
 */
async function countPrompts(page: Page): Promise<number> {
    return page.evaluate((prompt) => {
        const buffer = window.__protostar.term.buffer.active
        let count = 0
        for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i)
            if (!line) continue
            const text = line.translateToString(true)
            count += text.split(prompt).length - 1
        }
        return count
    }, PROMPT)
}

/**
 * Wait until LocalEchoController is active again AND a new prompt line has
 * been drawn past the given baseline count. This is stricter than
 * `waitForPrompt`, which only checks that *some* prompt is visible — the
 * original prompt is still on screen after Enter, so that looser check can
 * resolve before the command's output has been rendered.
 *
 * @param page - Playwright page.
 * @param beforeCount - Prompt count captured before the key was pressed.
 * @param timeout - Max ms to wait before failing.
 */
async function waitForNextPrompt(page: Page, beforeCount: number, timeout = 10_000): Promise<void> {
    await page.waitForFunction(
        ({ prompt, before }) => {
            const handle = window.__protostar
            if (!handle) return false
            if (!handle.shell.currentPrompt) return false
            const buffer = handle.term.buffer.active
            let count = 0
            for (let i = 0; i < buffer.length; i++) {
                const line = buffer.getLine(i)
                if (!line) continue
                const text = line.translateToString(true)
                count += text.split(prompt).length - 1
            }
            return count > before
        },
        { prompt: PROMPT, before: beforeCount },
        { timeout }
    )
}

/**
 * Press Enter and wait for a new prompt line to appear below the submitted
 * input — not just for the existing prompt to still be visible.
 *
 * @param page - Playwright page.
 */
export async function submit(page: Page): Promise<void> {
    const before = await countPrompts(page)
    await page.keyboard.press("Enter")
    await waitForNextPrompt(page, before)
}

/**
 * Send Ctrl+C and wait for a new prompt line to appear.
 *
 * @param page - Playwright page.
 */
export async function cancel(page: Page): Promise<void> {
    const before = await countPrompts(page)
    await page.keyboard.press("Control+c")
    await waitForNextPrompt(page, before)
}

export { PROMPT, SELECTORS }
