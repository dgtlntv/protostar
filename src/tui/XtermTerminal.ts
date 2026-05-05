import type { Terminal as PiTerminal } from "@mariozechner/pi-tui"

export interface XtermLike {
    readonly cols: number
    readonly rows: number
    write(data: string | Uint8Array, callback?: () => void): void
    onData(listener: (data: string) => void): { dispose(): void }
    onResize(listener: (size: { cols: number; rows: number }) => void): {
        dispose(): void
    }
}

export class XtermTerminalAdapter implements PiTerminal {
    private term: XtermLike
    private dataDisposable?: { dispose(): void }
    private resizeDisposable?: { dispose(): void }

    constructor(term: XtermLike) {
        this.term = term
    }

    start(onInput: (data: string) => void, onResize: () => void): void {
        this.dataDisposable = this.term.onData(onInput)
        this.resizeDisposable = this.term.onResize(() => onResize())
    }

    stop(): void {
        this.dataDisposable?.dispose()
        this.dataDisposable = undefined
        this.resizeDisposable?.dispose()
        this.resizeDisposable = undefined
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
}
