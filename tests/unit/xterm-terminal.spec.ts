import { describe, it, expect, vi } from "vitest"
import xterm from "@xterm/headless"
import { XtermTerminalAdapter } from "../../src/tui/XtermTerminal.js"

const HeadlessTerminal = xterm.Terminal

function makeTerm(cols = 80, rows = 24) {
    return new HeadlessTerminal({ cols, rows, allowProposedApi: true })
}

function flush(t: ReturnType<typeof makeTerm>): Promise<void> {
    return new Promise((resolve) => t.write("", () => resolve()))
}

function readLine(
    t: ReturnType<typeof makeTerm>,
    row: number
): string {
    const line = t.buffer.active.getLine(row)
    return line ? line.translateToString(true) : ""
}

describe("XtermTerminalAdapter", () => {
    it("write sends data to the xterm buffer", async () => {
        const term = makeTerm()
        const adapter = new XtermTerminalAdapter(term)
        adapter.write("hello world")
        await flush(term)
        expect(readLine(term, 0)).toBe("hello world")
    })

    it("columns and rows track the underlying terminal", () => {
        const term = makeTerm(132, 50)
        const adapter = new XtermTerminalAdapter(term)
        expect(adapter.columns).toBe(132)
        expect(adapter.rows).toBe(50)
    })

    it("start wires onData callbacks; stop disposes them", () => {
        const term = makeTerm()
        const adapter = new XtermTerminalAdapter(term)
        const onInput = vi.fn()
        const onResize = vi.fn()

        adapter.start(onInput, onResize)
        term.input("a", false)
        expect(onInput).toHaveBeenCalledWith("a")

        adapter.stop()
        term.input("b", false)
        expect(onInput).toHaveBeenCalledTimes(1)
    })

    it("onResize is invoked when the underlying terminal is resized", () => {
        const term = makeTerm()
        const adapter = new XtermTerminalAdapter(term)
        const onInput = vi.fn()
        const onResize = vi.fn()

        adapter.start(onInput, onResize)
        term.resize(100, 30)
        expect(onResize).toHaveBeenCalledTimes(1)
    })

    it("clearScreen emits CSI 2J + cursor home", async () => {
        const term = makeTerm()
        const adapter = new XtermTerminalAdapter(term)
        adapter.write("dirty")
        await flush(term)
        adapter.clearScreen()
        await flush(term)
        expect(readLine(term, 0)).toBe("")
        expect(term.buffer.active.cursorX).toBe(0)
        expect(term.buffer.active.cursorY).toBe(0)
    })

    it("hideCursor and showCursor toggle DECTCEM", async () => {
        const calls: string[] = []
        const fakeTerm = {
            cols: 80,
            rows: 24,
            write(data: string) {
                calls.push(data)
            },
            onData() {
                return { dispose() {} }
            },
            onResize() {
                return { dispose() {} }
            },
        }
        const adapter = new XtermTerminalAdapter(fakeTerm)
        adapter.hideCursor()
        adapter.showCursor()
        expect(calls).toEqual(["\x1b[?25l", "\x1b[?25h"])
    })

    it("clearLine and clearFromCursor emit the documented sequences", () => {
        const calls: string[] = []
        const fakeTerm = {
            cols: 80,
            rows: 24,
            write(data: string) {
                calls.push(data)
            },
            onData() {
                return { dispose() {} }
            },
            onResize() {
                return { dispose() {} }
            },
        }
        const adapter = new XtermTerminalAdapter(fakeTerm)
        adapter.clearLine()
        adapter.clearFromCursor()
        expect(calls).toEqual(["\x1b[K", "\x1b[J"])
    })

    it("moveBy emits CSI nA / nB depending on sign and is a no-op for 0", () => {
        const calls: string[] = []
        const fakeTerm = {
            cols: 80,
            rows: 24,
            write(data: string) {
                calls.push(data)
            },
            onData() {
                return { dispose() {} }
            },
            onResize() {
                return { dispose() {} }
            },
        }
        const adapter = new XtermTerminalAdapter(fakeTerm)
        adapter.moveBy(3)
        adapter.moveBy(-2)
        adapter.moveBy(0)
        expect(calls).toEqual(["\x1b[3B", "\x1b[2A"])
    })

    it("drainInput, setProgress, setTitle, kittyProtocolActive are safe no-ops", async () => {
        const term = makeTerm()
        const adapter = new XtermTerminalAdapter(term)
        await expect(adapter.drainInput()).resolves.toBeUndefined()
        expect(() => adapter.setProgress(true)).not.toThrow()
        expect(() => adapter.setTitle("ignored")).not.toThrow()
        expect(adapter.kittyProtocolActive).toBe(false)
    })
})
