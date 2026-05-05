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

import xterm from "@xterm/headless"
import type { Terminal as XtermHeadlessTerminal } from "@xterm/headless"
import type { Terminal as PiTerminal } from "@mariozechner/pi-tui"

const HeadlessTerminal = xterm.Terminal

export class VirtualTerminal implements PiTerminal {
    private term: XtermHeadlessTerminal
    private inputHandler?: (data: string) => void
    private resizeHandler?: () => void

    constructor(columns = 80, rows = 24) {
        this.term = new HeadlessTerminal({
            cols: columns,
            rows,
            allowProposedApi: true,
        })
    }

    start(onInput: (data: string) => void, onResize: () => void): void {
        this.inputHandler = onInput
        this.resizeHandler = onResize
    }

    stop(): void {
        this.inputHandler = undefined
        this.resizeHandler = undefined
    }

    async drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {}

    write(data: string): void {
        this.term.write(data)
    }

    get columns(): number {
        return this.term.cols
    }

    get rows(): number {
        return this.term.rows
    }

    get kittyProtocolActive(): boolean {
        return false
    }

    moveBy(lines: number): void {
        if (lines > 0) {
            this.term.write(`\x1b[${lines}B`)
        } else if (lines < 0) {
            this.term.write(`\x1b[${-lines}A`)
        }
    }

    hideCursor(): void {
        this.term.write("\x1b[?25l")
    }

    showCursor(): void {
        this.term.write("\x1b[?25h")
    }

    clearLine(): void {
        this.term.write("\x1b[K")
    }

    clearFromCursor(): void {
        this.term.write("\x1b[J")
    }

    clearScreen(): void {
        this.term.write("\x1b[2J\x1b[H")
    }

    setTitle(_title: string): void {}
    setProgress(_active: boolean): void {}

    sendInput(data: string): void {
        this.inputHandler?.(data)
    }

    resize(columns: number, rows: number): void {
        this.term.resize(columns, rows)
        this.resizeHandler?.()
    }

    async flush(): Promise<void> {
        return new Promise<void>((resolve) => {
            this.term.write("", () => resolve())
        })
    }

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

    async getCursorPosition(): Promise<{ x: number; y: number }> {
        await this.flush()
        const buffer = this.term.buffer.active
        return { x: buffer.cursorX, y: buffer.cursorY }
    }
}
