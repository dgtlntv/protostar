/**
 * @file Adapter that fulfills pi-tui's `Terminal` interface against an xterm.js
 * Terminal instance, so pi-tui's diff renderer can drive an xterm in the
 * browser (or `@xterm/headless` under unit tests).
 */

import type { Terminal as PiTerminal } from "@mariozechner/pi-tui"

/**
 * Structural subset of the xterm Terminal API that the adapter actually uses.
 *
 * Declared structurally rather than imported from `@xterm/xterm` so the same
 * adapter can wrap either the browser build or `@xterm/headless` (the two
 * packages don't share a type, but they share this surface).
 */
export interface XtermLike {
    readonly cols: number
    readonly rows: number
    write(data: string | Uint8Array, callback?: () => void): void
    onData(listener: (data: string) => void): { dispose(): void }
    onResize(listener: (size: { cols: number; rows: number }) => void): {
        dispose(): void
    }
}

/**
 * Implements pi-tui's `Terminal` interface in terms of an xterm.js terminal.
 *
 * Most methods translate one-to-one to ANSI sequences written through
 * `xterm.write`. A handful (`drainInput`, `setTitle`, `setProgress`,
 * `kittyProtocolActive`) are no-ops in the browser context — pi-tui calls
 * them but xterm doesn't need or support them client-side.
 */
export class XtermTerminalAdapter implements PiTerminal {
    private term: XtermLike
    private dataDisposable?: { dispose(): void }
    private resizeDisposable?: { dispose(): void }

    /** @param term An xterm.js (browser or headless) Terminal instance. */
    constructor(term: XtermLike) {
        this.term = term
    }

    /**
     * Wire pi-tui's input/resize callbacks to xterm's event emitters. Call
     * `stop` to detach.
     *
     * @param onInput Invoked for each chunk emitted by `xterm.onData`.
     * @param onResize Invoked when xterm reports a viewport resize.
     */
    start(onInput: (data: string) => void, onResize: () => void): void {
        this.dataDisposable = this.term.onData(onInput)
        this.resizeDisposable = this.term.onResize(() => onResize())
    }

    /** Detach the listeners registered by `start`. Idempotent. */
    stop(): void {
        this.dataDisposable?.dispose()
        this.dataDisposable = undefined
        this.resizeDisposable?.dispose()
        this.resizeDisposable = undefined
    }

    /**
     * Browser xterm has no stdin queue to drain; this is a no-op kept to
     * satisfy pi-tui's interface (Node terminals use it to flush late kitty
     * key-release events before exit).
     *
     * @param _maxMs Maximum drain time in ms. Ignored.
     * @param _idleMs Early-exit threshold in ms. Ignored.
     * @returns A promise that resolves immediately.
     */
    async drainInput(_maxMs?: number, _idleMs?: number): Promise<void> {}

    /**
     * Pass-through to `xterm.write`.
     *
     * @param data Bytes to write to the terminal buffer.
     */
    write(data: string): void {
        this.term.write(data)
    }

    /** @returns Current viewport column count. */
    get columns(): number {
        return this.term.cols
    }

    /** @returns Current viewport row count. */
    get rows(): number {
        return this.term.rows
    }

    /**
     * Always `false` for xterm.js. The Kitty keyboard protocol is a
     * host-terminal feature; pi-tui falls back to legacy xterm sequences when
     * this is false.
     *
     * @returns `false`, always.
     */
    get kittyProtocolActive(): boolean {
        return false
    }

    /**
     * Move the cursor `lines` rows. Positive moves down (CSI nB), negative up
     * (CSI nA). `lines === 0` is a no-op.
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

    /** Erase from the cursor to the end of the current line (CSI K). */
    clearLine(): void {
        this.term.write("\x1b[K")
    }

    /** Erase from the cursor to the end of the screen (CSI J). */
    clearFromCursor(): void {
        this.term.write("\x1b[J")
    }

    /** Clear the whole screen and home the cursor (CSI 2J + CSI H). */
    clearScreen(): void {
        this.term.write("\x1b[2J\x1b[H")
    }

    /**
     * No-op. Browser tabs don't expose a programmable title from xterm.
     *
     * @param _title Ignored.
     */
    setTitle(_title: string): void {}

    /**
     * No-op. Progress reporting is a host-terminal concern (e.g. Windows
     * OSC 9;4).
     *
     * @param _active Ignored.
     */
    setProgress(_active: boolean): void {}
}
