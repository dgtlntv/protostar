/**
 * @file Specs for the multi-line shell `PromptLine`. Covers three
 * shell-parity surfaces:
 *   - Ctrl+C cancel.
 *   - Cross-line cursor / Backspace / Home/End.
 *   - Bracketed-paste line-ending normalization, per-line dispatch, and
 *     incomplete-first-line continuation.
 */

import { describe, it, expect } from "vitest"
import { TUI } from "@mariozechner/pi-tui"
import { VirtualTerminal } from "./helpers/virtualTerm.js"
import { HistoryStore } from "../../src/shell/HistoryStore.js"
import { PromptLine } from "../../src/shell/PromptLine.js"

const PROMPT = "user@ubuntu:~$ "
const PASTE_START = "\x1b[200~"
const PASTE_END = "\x1b[201~"
const ENTER = "\r"
const CTRL_C = "\x03"
const ARROW_LEFT = "\x1b[D"
const ARROW_RIGHT = "\x1b[C"
const ARROW_UP = "\x1b[A"
const ARROW_DOWN = "\x1b[B"
const HOME = "\x1b[H"
const END = "\x1b[F"
const BACKSPACE = "\x7f"
const ALT_BACKSPACE = "\x1b\x7f"

/**
 * Mount a fresh `PromptLine` on a virtual terminal-backed TUI. Returns
 * everything the tests need to drive input and inspect outcomes.
 *
 * @returns Harness components: term, tui, history, prompt, completed lines
 *   recorded across `onComplete` events, and a `cancelCount` for `onCancel`.
 */
function mount(): {
    term: VirtualTerminal
    tui: TUI
    history: HistoryStore
    prompt: PromptLine
    completed: string[][]
    cancelCount: () => number
} {
    const term = new VirtualTerminal(80, 24)
    const tui = new TUI(term, false)
    tui.start()
    const history = new HistoryStore(10)
    const prompt = new PromptLine(PROMPT, history)
    const completed: string[][] = []
    let cancels = 0
    prompt.onComplete = (lines) => completed.push(lines)
    prompt.onCancel = () => {
        cancels++
    }
    tui.addChild(prompt)
    tui.setFocus(prompt)
    return {
        term,
        tui,
        history,
        prompt,
        completed,
        cancelCount: () => cancels,
    }
}

/** Type a string one character at a time so each char is a discrete input. */
function type(term: VirtualTerminal, text: string): void {
    for (const ch of text) term.sendInput(ch)
}

/**
 * Wrap `text` in bracketed-paste markers and deliver as a single chunk —
 * matches what xterm.js produces when paste mode is active.
 */
function paste(term: VirtualTerminal, text: string): void {
    term.sendInput(PASTE_START + text + PASTE_END)
}

describe("PromptLine — basic editing", () => {
    it("inserts typed characters into the buffer", () => {
        const { term, prompt } = mount()
        type(term, "hello")
        expect(prompt.getValue()).toBe("hello")
        expect(prompt.getCursor()).toBe(5)
    })

    it("rejects bare control characters", () => {
        const { term, prompt } = mount()
        term.sendInput("\x1b") // Escape
        expect(prompt.getValue()).toBe("")
    })

    it("Backspace removes the grapheme before the cursor", () => {
        const { term, prompt } = mount()
        type(term, "abc")
        term.sendInput(BACKSPACE)
        expect(prompt.getValue()).toBe("ab")
        expect(prompt.getCursor()).toBe(2)
    })

    it("Alt+Backspace deletes the previous word", () => {
        const { term, prompt } = mount()
        type(term, "hello world")
        term.sendInput(ALT_BACKSPACE)
        expect(prompt.getValue()).toBe("hello ")
        expect(prompt.getCursor()).toBe(6)
    })
})

describe("PromptLine — Enter / submit", () => {
    it("fires onComplete with the buffer when isIncomplete returns false", () => {
        const { term, prompt, completed } = mount()
        type(term, "logout")
        term.sendInput(ENTER)
        expect(completed).toEqual([["logout"]])
        // After submit the prompt clears so the embedder can mount a fresh one.
        expect(prompt.getValue()).toBe("")
    })

    it("inserts a literal newline when isIncomplete returns true", () => {
        const { term, prompt, completed } = mount()
        type(term, 'echo "hi')
        term.sendInput(ENTER)
        expect(prompt.getValue()).toBe('echo "hi\n')
        expect(prompt.getCursor()).toBe('echo "hi\n'.length)
        expect(completed).toEqual([])
    })

    it("submits once the continuation closes", () => {
        const { term, prompt, completed } = mount()
        type(term, 'echo "hi')
        term.sendInput(ENTER)
        type(term, 'there"')
        term.sendInput(ENTER)
        expect(completed).toEqual([['echo "hi\nthere"']])
        expect(prompt.getValue()).toBe("")
    })
})

describe("PromptLine — multi-line cursor", () => {
    /**
     * Build a deterministic two-line buffer using the unclosed-quote
     * continuation trick: type `'a`, Enter, type `b'`. Final state is
     * `value = "'a\nb'"` (5 chars) with the cursor at offset 5.
     */
    function buildTwoLines(term: VirtualTerminal): void {
        type(term, "'a")
        term.sendInput(ENTER)
        type(term, "b'")
    }

    it("Left at column 0 of line 2 lands on the newline", () => {
        const { term, prompt } = mount()
        buildTwoLines(term)
        expect(prompt.getValue()).toBe("'a\nb'")
        expect(prompt.getCursor()).toBe(5)
        term.sendInput(ARROW_LEFT)
        term.sendInput(ARROW_LEFT)
        expect(prompt.getCursor()).toBe(3)
        term.sendInput(ARROW_LEFT)
        expect(prompt.getCursor()).toBe(2)
    })

    it("Right at end of line 1 lands at column 0 of line 2", () => {
        const { term, prompt } = mount()
        buildTwoLines(term)
        for (let i = 0; i < 3; i++) term.sendInput(ARROW_LEFT)
        expect(prompt.getCursor()).toBe(2)
        term.sendInput(ARROW_RIGHT)
        expect(prompt.getCursor()).toBe(3)
    })

    it("inserts mid-line on line 2 at the correct offset", () => {
        const { term, prompt } = mount()
        buildTwoLines(term)
        term.sendInput(ARROW_LEFT)
        expect(prompt.getCursor()).toBe(4)
        type(term, "X")
        expect(prompt.getValue()).toBe("'a\nbX'")
        expect(prompt.getCursor()).toBe(5)
    })

    it("Backspace at column 0 of line 2 joins the lines", () => {
        const { term, prompt } = mount()
        buildTwoLines(term)
        for (let i = 0; i < 2; i++) term.sendInput(ARROW_LEFT)
        expect(prompt.getCursor()).toBe(3)
        term.sendInput(BACKSPACE)
        expect(prompt.getValue()).toBe("'ab'")
        expect(prompt.getCursor()).toBe(2)
    })

    it("Home and End on multi-line target whole-buffer bounds", () => {
        const { term, prompt } = mount()
        buildTwoLines(term)
        expect(prompt.getCursor()).toBe(5)
        term.sendInput(HOME)
        expect(prompt.getCursor()).toBe(0)
        term.sendInput(END)
        expect(prompt.getCursor()).toBe(5)
        // Home from mid-line-2 still jumps to absolute 0, not line-2 start.
        term.sendInput(ARROW_LEFT)
        expect(prompt.getCursor()).toBe(4)
        term.sendInput(HOME)
        expect(prompt.getCursor()).toBe(0)
    })
})

describe("PromptLine — Ctrl+C cancel", () => {
    it("fires onCancel without firing onComplete", () => {
        const { term, completed, cancelCount } = mount()
        type(term, "partial")
        term.sendInput(CTRL_C)
        expect(cancelCount()).toBe(1)
        expect(completed).toEqual([])
    })

    it("fires onCancel on empty input", () => {
        const { term, cancelCount } = mount()
        term.sendInput(CTRL_C)
        expect(cancelCount()).toBe(1)
    })

    it("fires onCancel during a multi-line continuation", () => {
        const { term, prompt, completed, cancelCount } = mount()
        type(term, 'echo "hi')
        term.sendInput(ENTER)
        expect(prompt.getValue()).toBe('echo "hi\n')
        term.sendInput(CTRL_C)
        expect(cancelCount()).toBe(1)
        expect(completed).toEqual([])
    })
})

describe("PromptLine — paste", () => {
    it("inserts a single-line paste at the cursor", () => {
        const { term, prompt, completed } = mount()
        paste(term, "hello")
        expect(prompt.getValue()).toBe("hello")
        expect(completed).toEqual([])
    })

    it("normalizes \\r\\n line endings inside an unclosed quote", () => {
        const { term, prompt, completed } = mount()
        paste(term, "'a\r\nb'")
        expect(prompt.getValue()).toBe("'a\nb'")
        expect(completed).toEqual([])
    })

    it("normalizes mixed \\n / \\r / \\r\\n line endings", () => {
        const { term, prompt, completed } = mount()
        paste(term, "'a\nb\rc\r\nd'")
        expect(prompt.getValue()).toBe("'a\nb\nc\nd'")
        expect(completed).toEqual([])
    })

    it("continues across the newline when the first line is incomplete", () => {
        const { term, prompt, completed } = mount()
        paste(term, 'echo "hi\nthere"')
        expect(prompt.getValue()).toBe('echo "hi\nthere"')
        expect(completed).toEqual([])
    })

    it("dispatches each shell-complete line as a separate submission", () => {
        const { term, prompt, completed } = mount()
        paste(term, "logout\nlogout\n")
        expect(completed).toEqual([["logout", "logout"]])
        // The trailing-empty-segment after the last \n is the live tail.
        expect(prompt.getValue()).toBe("")
    })

    it("leaves the trailing tail editable when paste ends mid-line", () => {
        const { term, prompt, completed } = mount()
        paste(term, "logout\necho ")
        expect(completed).toEqual([["logout"]])
        expect(prompt.getValue()).toBe("echo ")
        // Continued typing extends the tail.
        type(term, "hi")
        expect(prompt.getValue()).toBe("echo hi")
    })
})

describe("PromptLine — history navigation", () => {
    it("ArrowUp installs the previous history entry and parks the cursor at end", () => {
        const { term, prompt, history } = mount()
        history.push("first")
        history.push("second")
        history.rewind()
        term.sendInput(ARROW_UP)
        expect(prompt.getValue()).toBe("second")
        expect(prompt.getCursor()).toBe(6)
    })

    it("ArrowDown past the newest entry clears the buffer", () => {
        const { term, prompt, history } = mount()
        history.push("only")
        history.rewind()
        term.sendInput(ARROW_UP)
        expect(prompt.getValue()).toBe("only")
        term.sendInput(ARROW_DOWN)
        expect(prompt.getValue()).toBe("")
    })
})

describe("PromptLine — render", () => {
    it("first row carries the prompt prefix; continuation rows do not", async () => {
        const { term, tui } = mount()
        type(term, "'a")
        term.sendInput(ENTER)
        type(term, "b'")
        tui.requestRender(true)
        await new Promise<void>((resolve) => process.nextTick(resolve))
        const lines = await term.getViewport()
        const first = lines.find((l) => l.includes(PROMPT))
        expect(first).toBeDefined()
        expect(first).toContain("'a")
        // The continuation line `b'` lives on the row immediately below.
        const idx = lines.indexOf(first as string)
        expect(lines[idx + 1]).toContain("b'")
        expect(lines[idx + 1].startsWith(PROMPT)).toBe(false)
    })
})
