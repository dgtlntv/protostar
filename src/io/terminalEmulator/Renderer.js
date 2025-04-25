/**
 * Handles rendering output to the terminal, including text,
 * prompts, input lines, and cursor positioning using ANSI escape codes.
 */

import ansiEscapes from "ansi-escapes"
import ansiRegex from "ansi-regex"
import { countLines, offsetToColRow } from "./Utils"

export class Renderer {
    constructor(term, state) {
        this.term = term
        this.state = state
    }

    /** Writes raw data to the terminal. */
    write(data) {
        this.term.write(data)
    }

    /** Prints a message and changes line. */
    println(message) {
        this.print(message + "\r\n")
    }

    /** Prints a message, handling newlines correctly. */
    print(message) {
        this.write(message.replace(/\r?\n/g, "\r\n"))
    }

    /** Applies the current prompt(s) to the input string for display. */
    applyPrompts(input) {
        const activePrompt = this.state.getActivePrompt()
        const prompt = activePrompt?.prompt || ""
        const continuationPrompt = activePrompt?.continuationPrompt || ""
        // Ensure the first line gets the main prompt, subsequent lines get the continuation prompt
        return prompt + input.replace(/\n/g, "\n" + continuationPrompt)
    }

    /** Calculates the visual character offset corresponding to a logical offset in the input, considering prompts. */
    applyPromptOffset(input, offset) {
        // Get the input string with prompts applied up to the logical offset
        const inputWithPrompts = this.applyPrompts(input.substring(0, offset))
        // Calculate the length after stripping ANSI codes (visual length)
        return inputWithPrompts.replace(ansiRegex(), "").length
    }

    /** Clears the currently displayed input prompt and lines. */
    clearInputDisplay() {
        const currentInput = this.state.getInput()
        const currentCursor = this.state.getCursor()
        const { cols } = this.state.getTermSize()
        const inputWithPrompts = this.applyPrompts(currentInput)

        // Calculate the cursor's current row within the potentially multi-line prompt
        const promptCursorOffset = this.applyPromptOffset(
            currentInput,
            currentCursor
        )

        const { row: currentRow } = offsetToColRow(
            inputWithPrompts,
            promptCursorOffset,
            cols
        )

        // 1. Move cursor to the beginning of the logical line it's on
        this.write(ansiEscapes.cursorLeft) // Go to column 0
        // 2. Move cursor up to the first line of the prompt
        if (currentRow > 0) {
            this.write(ansiEscapes.cursorUp(currentRow))
        }
        // 3. Erase from the cursor down to the end of the screen/display area
        this.write(ansiEscapes.eraseDown)
    }

    /** Redraws the input line with prompts and positions the cursor correctly. */
    redrawInputLine() {
        const input = this.state.getInput()
        const cursor = this.state.getCursor()
        const { cols } = this.state.getTermSize()

        // Prepare the full string with prompts
        const inputWithPrompts = this.applyPrompts(input)

        // Write the prompted input to the terminal
        this.print(inputWithPrompts)

        // Calculate the target cursor position in terminal coordinates
        const targetPromptOffset = this.applyPromptOffset(input, cursor)
        const { col: targetCol, row: targetRow } = offsetToColRow(
            inputWithPrompts,
            targetPromptOffset,
            cols
        )

        // Calculate how many lines the total output spans
        const totalRows = countLines(inputWithPrompts, cols)

        // Calculate how many lines we need to move *up* from the *end* of the output
        const moveUpRows = totalRows - 1 - targetRow

        // Position the cursor
        // 1. Go to the beginning of the last line written
        this.write(ansiEscapes.cursorLeft)
        // 2. Move up if necessary
        if (moveUpRows > 0) {
            this.write(ansiEscapes.cursorUp(moveUpRows))
        }
        // 3. Move forward to the target column
        if (targetCol > 0) {
            this.write(ansiEscapes.cursorForward(targetCol))
        }
    }

    /**
     * Updates the displayed input efficiently. Clears the old input,
     * writes the new input with prompts, and positions the cursor.
     * @param {string} newInput The new input string to display.
     */
    setInputDisplay(newInput) {
        this.clearInputDisplay()
        // Temporarily set the state's input to the new value for rendering calculations
        const oldInput = this.state.getInput() // Backup old state
        const oldCursor = this.state.getCursor()
        this.state.setInput(newInput)
        // Ensure cursor is valid for the new input *during rendering*
        this.state.setCursor(Math.min(oldCursor, newInput.length))

        this.redrawInputLine()

        // Restore original state (cursor position might be different after redraw calculation)
        this.state.setInput(oldInput)
        this.state.setCursor(oldCursor)
        // Caller is responsible for the final state update (setInput, setCursor) *after* calling this.
    }

    /**
     * Specialised update for history navigation to reduce flicker.
     * Assumes the cursor will be at the end of the new value.
     * @param {string} historyValue The history value to display.
     */
    setHistoryInputDisplay(historyValue) {
        this.cursorHide()
        this.clearInputDisplay()

        // Temporarily update state for rendering
        const oldInput = this.state.getInput()
        this.state.setInput(historyValue)
        this.state.setCursor(historyValue.length) // Cursor at end for history

        this.redrawInputLine()

        // Restore original input state (caller will update it fully)
        this.state.setInput(oldInput)

        this.cursorShow()
    }

    /** Updates the cursor position on the screen based on the state's cursor value. */
    updateCursorDisplay() {
        // This can be complex. For simplicity, we often rely on redrawInputLine
        // which includes cursor positioning. A more optimized version could
        // calculate relative moves, but redrawInputLine is safer.
        this.redrawInputLine()
    }

    /** Prints items in a wide, columnized format. */
    printWide(items, padding = 2) {
        if (!items || items.length === 0) {
            this.println("")
            return
        }

        const { cols } = this.state.getTermSize()

        // Compute item sizes and matrix dimensions
        const itemWidth =
            items.reduce((width, item) => Math.max(width, item.length), 0) +
            padding
        const wideCols = Math.max(1, Math.floor(cols / itemWidth)) // Ensure at least one column
        const wideRows = Math.ceil(items.length / wideCols)

        // Print matrix row by row
        for (let row = 0; row < wideRows; ++row) {
            let rowStr = ""
            for (let col = 0; col < wideCols; ++col) {
                const index = row + col * wideRows // Items are filled column-first
                if (index < items.length) {
                    let item = items[index]
                    // Pad item to the calculated width
                    item += " ".repeat(Math.max(0, itemWidth - item.length))
                    rowStr += item
                }
            }
            this.println(rowStr.trimEnd())
        }
    }
}
