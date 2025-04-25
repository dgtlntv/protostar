/**
 * Manages the mutable state of the terminal emulator,
 * including input buffer, cursor position, active prompts, and terminal size.
 */

export class State {
    constructor(termCols = 80, termRows = 24) {
        this._input = ""
        this._cursor = 0
        this._active = false
        this._activePrompt = null
        this._activeCharPrompt = null
        this._termSize = { cols: termCols, rows: termRows }
    }

    // --- Getters ---
    getInput() {
        return this._input
    }
    getCursor() {
        return this._cursor
    }
    isActive() {
        return this._active
    }
    getActivePrompt() {
        return this._activePrompt
    }
    getActiveCharPrompt() {
        return this._activeCharPrompt
    }
    getTermSize() {
        return this._termSize
    }

    // --- Setters ---
    setInput(value) {
        this._input = value
    }
    setCursor(value) {
        this._cursor = Math.max(0, Math.min(value, this._input.length))
    }
    setActive(value) {
        this._active = value
    }
    setActivePrompt(value) {
        this._activePrompt = value
    }
    setActiveCharPrompt(value) {
        this._activeCharPrompt = value
    }
    setTermSize(cols, rows) {
        this._termSize = { cols, rows }
    }

    // --- Modifiers ---
    incrementCursor() {
        this.setCursor(this._cursor + 1)
    }

    decrementCursor() {
        this.setCursor(this._cursor - 1)
    }

    insertData(data) {
        const before = this._input.substring(0, this._cursor)
        const after = this._input.substring(this._cursor)
        this._input = before + data + after
        this._cursor += data.length
    }

    deleteData(backspace = true, count = 1) {
        if (backspace) {
            if (this._cursor <= 0) return
            const deleteStart = Math.max(0, this._cursor - count)
            const before = this._input.substring(0, deleteStart)
            const after = this._input.substring(this._cursor)
            this._input = before + after
            this.setCursor(deleteStart)
        } else {
            if (this._cursor >= this._input.length) return
            const deleteStart = this._cursor
            const deleteEnd = Math.min(this._input.length, this._cursor + count)
            const before = this._input.substring(0, deleteStart)
            const after = this._input.substring(deleteEnd)
            this._input = before + after
            this.setCursor(this._cursor)
        }
    }

    resetInput() {
        this._input = ""
        this._cursor = 0
    }
}
