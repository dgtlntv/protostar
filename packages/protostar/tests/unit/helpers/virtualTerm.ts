// Adapted from pi-mono (https://github.com/badlogic/pi-mono),
// packages/tui/test/virtual-terminal.ts.
//
// Copyright (c) 2025 Mario Zechner
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

/**
 * @file Headless pi-tui `Terminal` for Vitest. Mirrors the production
 * `XtermTerminalAdapter` and adds test-only helpers (`sendInput`, `resize`,
 * `flush`, `getViewport`, `getCursorPosition`) so specs can drive components
 * without a real DOM.
 */

import xterm from "@xterm/headless"
import type { Terminal as XtermHeadlessTerminal } from "@xterm/headless"
import type { Terminal as PiTerminal } from "@earendil-works/pi-tui"

const HeadlessTerminal = xterm.Terminal

/**
 * Implements pi-tui's `Terminal` interface against `@xterm/headless`. Behaves
 * like `XtermTerminalAdapter` for all interface methods; additional methods
 * exist to read back the rendered state.
 */
export class VirtualTerminal implements PiTerminal {
    private term: XtermHeadlessTerminal
    private inputHandler?: (data: string) => void
    private resizeHandler?: () => void

    /** @param columns Initial column count. @param rows Initial row count. */
    constructor(columns = 80, rows = 24) {
        this.term = new HeadlessTerminal({
            cols: columns,
            rows,
            allowProposedApi: true,
        })
    }

    /**
     * Register input/resize handlers; mirrors pi-tui's lifecycle contract.
     *
     * @param onInput Invoked when `sendInput` is called.
     * @param onResize Invoked when `resize` is called.
     */
    start(onInput: (data: string) => void, onResize: () => void): void {
        this.inputHandler = onInput
        this.resizeHandler = onResize
    }

    /** Detach the handlers registered by `start`. */
    stop(): void {
        this.inputHandler = undefined
        this.resizeHandler = undefined
    }

    /**
     * No-op; nothing to drain in a synthetic terminal.
     *
     * @param _maxMs Ignored.
     * @param _idleMs Ignored.
     * @returns A promise that resolves immediately.
     */
    async drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {}

    /**
     * Pass-through to the headless xterm.
     *
     * @param data Bytes to write to the terminal buffer.
     */
    write(data: string): void {
        this.term.write(data)
    }

    /** @returns Column count of the underlying headless terminal. */
    get columns(): number {
        return this.term.cols
    }

    /** @returns Row count of the underlying headless terminal. */
    get rows(): number {
        return this.term.rows
    }

    /** @returns Always `false` — kitty protocol is not relevant under test. */
    get kittyProtocolActive(): boolean {
        return false
    }

    /**
     * Move cursor `lines` rows (positive = down, negative = up).
     *
     * @param lines Signed row delta.
     */
    moveBy(lines: number): void {
        if (lines > 0) {
            this.term.write(`\x1b[${lines}B`)
        } else if (lines < 0) {
            this.term.write(`\x1b[${-lines}A`)
        }
    }

    /** DECTCEM hide cursor. */
    hideCursor(): void {
        this.term.write("\x1b[?25l")
    }

    /** DECTCEM show cursor. */
    showCursor(): void {
        this.term.write("\x1b[?25h")
    }

    /** Erase from cursor to end of line (CSI K). */
    clearLine(): void {
        this.term.write("\x1b[K")
    }

    /** Erase from cursor to end of screen (CSI J). */
    clearFromCursor(): void {
        this.term.write("\x1b[J")
    }

    /** Clear screen and home cursor (CSI 2J + CSI H). */
    clearScreen(): void {
        this.term.write("\x1b[2J\x1b[H")
    }

    /**
     * No-op.
     *
     * @param _title Ignored.
     */
    setTitle(_title: string): void {}

    /**
     * No-op.
     *
     * @param _active Ignored.
     */
    setProgress(_active: boolean): void {}

    /**
     * Simulate keyboard input by invoking the handler `start` registered.
     *
     * @param data Bytes to deliver to the input handler.
     */
    sendInput(data: string): void {
        this.inputHandler?.(data)
    }

    /**
     * Resize the underlying terminal and notify the handler `start`
     * registered.
     *
     * @param columns New column count.
     * @param rows New row count.
     */
    resize(columns: number, rows: number): void {
        this.term.resize(columns, rows)
        this.resizeHandler?.()
    }

    /**
     * Wait for queued `xterm.write` callbacks to flush before reading the
     * buffer back. xterm.js processes writes asynchronously, so callers must
     * await this (or `getViewport` / `getCursorPosition`) after writing.
     *
     * @returns A promise that resolves once the write queue has drained.
     */
    async flush(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.term.write("", () => resolve())
        })
    }

    /**
     * Flush pending writes, then return the visible viewport as one string
     * per row. Trailing whitespace on each row is trimmed by xterm's
     * `translateToString(true)`.
     *
     * @returns Viewport contents, one string per row, top to bottom.
     */
    async getViewport(): Promise<string[]> {
        await this.flush()
        const lines: string[] = []
        const buffer = this.term.buffer.active
        for (let i = 0; i < this.term.rows; i++) {
            const line = buffer.getLine(buffer.viewportY + i)
            lines.push(line ? line.translateToString(true) : "")
        }
        return lines
    }

    /**
     * Flush pending writes, then return the current cursor position.
     *
     * @returns `{ x, y }` — `x` is the column index, `y` the row index.
     */
    async getCursorPosition(): Promise<{ x: number; y: number }> {
        await this.flush()
        const buffer = this.term.buffer.active
        return { x: buffer.cursorX, y: buffer.cursorY }
    }
}
