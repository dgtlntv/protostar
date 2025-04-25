/**
 * Handles decoded keyboard input, manages cursor movement,
 * insertion/deletion, history navigation, and determines when input is complete.
 */

import { decodeANSIKeypressData } from "./Decoder"
import {
    closestLeftBoundary,
    closestRightBoundary,
    isIncompleteInput,
} from "./Utils"

export class Input {
    constructor(state, history, renderer, terminalEmulator) {
        this.state = state
        this.history = history
        this.renderer = renderer
        this.emulator = terminalEmulator
    }

    /**
     * Processes raw data received from the terminal.
     * Decodes it and passes it to the active input handler.
     * Handles multi-character sequences (like pasted text).
     * @param {string | Buffer} data Raw data from the terminal.
     */
    handleTermData(data) {
        // If we're not actively reading line input, check for char prompt or emit keypress
        if (!this.state.isActive()) {
            const charPrompt = this.state.getActiveCharPrompt()
            if (charPrompt) {
                // Resolve char prompt immediately
                charPrompt.resolve(
                    typeof data === "string" ? data : data.toString()
                )
                this.state.setActiveCharPrompt(null)
                this.renderer.println("") // Move to next line after char input
                return
            } else {
                // Emit raw keypress if no prompts are active
                const { ch, key } = decodeANSIKeypressData(data)
                this.emulator.emit("keypress", ch, key)
                return
            }
        }

        // If it looks like a pasted input (multiple chars, not starting with ESC), process char by char
        const dataStr = typeof data === "string" ? data : data.toString()
        if (dataStr.length > 1 && dataStr.charCodeAt(0) !== 0x1b /* ESC */) {
            const normalizedData = dataStr.replace(/[\r\n]+/g, "\r") // Normalize line endings to \r for Enter
            Array.from(normalizedData).forEach((char) =>
                this.decodeAndHandle(char)
            )
        } else {
            this.decodeAndHandle(dataStr)
        }
    }

    /**
     * Decodes a single piece of data (key press or sequence) and handles it.
     * @param {string} data Single character or ANSI sequence.
     */
    decodeAndHandle(data) {
        const { ch, key } = decodeANSIKeypressData(data)

        // If actively reading line input, handle the key press
        if (this.state.isActive()) {
            this.handleActiveKey(ch, key)
        }
    }

    /**
     * Handles key presses when the controller is actively reading a line.
     * @param {string | undefined} ch The printable character, if any.
     * @param {object | undefined} key The key descriptor object.
     */
    handleActiveKey(ch, key) {
        const keyName = key?.name
        const ctrl = key?.ctrl || false
        const meta = key?.meta || false

        let historyValue
        let boundary

        switch (keyName) {
            case "up":
                historyValue = this.history.getPrevious()
                if (historyValue !== undefined) {
                    // Check for undefined explicitly
                    this.renderer.setHistoryInputDisplay(historyValue)
                    this.state.setInput(historyValue)
                    this.state.setCursor(historyValue.length)
                }
                break

            case "down":
                historyValue = this.history.getNext()
                // If historyValue is undefined, it means we moved past the end, clear input
                const newValue = historyValue === undefined ? "" : historyValue
                this.renderer.setHistoryInputDisplay(newValue)
                this.state.setInput(newValue)
                this.state.setCursor(newValue.length)
                break

            case "left":
                if (meta) {
                    // Alt+Left Arrow - move to previous word start
                    boundary = closestLeftBoundary(
                        this.state.getInput(),
                        this.state.getCursor()
                    )
                    if (this.state.getCursor() !== boundary) {
                        this.state.setCursor(boundary)
                        this.renderer.updateCursorDisplay()
                    }
                } else {
                    // Simple Left Arrow
                    if (this.state.getCursor() > 0) {
                        this.state.decrementCursor()
                        this.renderer.updateCursorDisplay()
                    }
                }
                break

            case "right":
                if (meta) {
                    // Alt+Right Arrow - move to next word end
                    boundary = closestRightBoundary(
                        this.state.getInput(),
                        this.state.getCursor()
                    )
                    if (this.state.getCursor() !== boundary) {
                        this.state.setCursor(boundary)
                        this.renderer.updateCursorDisplay()
                    }
                } else {
                    // Simple Right Arrow
                    if (this.state.getCursor() < this.state.getInput().length) {
                        this.state.incrementCursor()
                        this.renderer.updateCursorDisplay()
                    }
                }
                break

            case "home": // Go to beginning of line
                if (this.state.getCursor() !== 0) {
                    this.state.setCursor(0)
                    this.renderer.updateCursorDisplay()
                }
                break

            case "end": // Go to end of line
                const endPos = this.state.getInput().length
                if (this.state.getCursor() !== endPos) {
                    this.state.setCursor(endPos)
                    this.renderer.updateCursorDisplay()
                }
                break

            case "backspace":
                if (ctrl) {
                    // Ctrl+Backspace - delete word backward
                    boundary = closestLeftBoundary(
                        this.state.getInput(),
                        this.state.getCursor()
                    )
                    if (boundary !== this.state.getCursor()) {
                        const count = this.state.getCursor() - boundary
                        this.state.deleteData(true, count) // Backspace `count` characters
                        this.renderer.setInputDisplay(this.state.getInput()) // Full redraw needed
                        // Cursor is already updated by deleteData
                    }
                } else {
                    // Simple Backspace
                    if (this.state.getCursor() > 0) {
                        this.state.deleteData(true) // Backspace 1 character
                        this.renderer.setInputDisplay(this.state.getInput()) // Full redraw needed
                    }
                }
                break

            case "delete": // Delete key (forward delete)
                // TODO: Add Ctrl+Delete for word forward deletion?
                if (this.state.getCursor() < this.state.getInput().length) {
                    this.state.deleteData(false) // Forward delete 1 character
                    this.renderer.setInputDisplay(this.state.getInput()) // Full redraw needed
                }
                break

            case "enter":
                const currentInput = this.state.getInput()
                if (isIncompleteInput(currentInput)) {
                    // Insert newline for incomplete input
                    this.handleCharacterInput("\n")
                } else {
                    // Complete the read operation
                    this.renderer.println("") // Move cursor to start of next line before resolving
                    this.emulator.completeRead(currentInput) // Let emulator handle history, promise, state reset
                }
                break

            case "c": // Check for Ctrl+C
                if (ctrl) {
                    this.renderer.println("^C") // Display ^C
                    this.emulator.emit("SIGINT") // Emit SIGINT signal
                    this.history.rewind()
                    this.state.resetInput()
                    this.state.setCursor(0) // Ensure cursor state matches
                    this.emulator.requestPromptDisplay()
                } else {
                    // Regular 'c' character
                    this.handleCharacterInput(ch)
                }
                break

            case "tab":
                // Autocomplete removed. Default behavior: insert spaces (e.g., 4 spaces).
                this.handleCharacterInput("    ")
                break

            default:
                // Handle general character input
                if (ch && !ctrl && !meta) {
                    // Only insert printable chars without Ctrl/Meta
                    this.handleCharacterInput(ch)
                }
                break
        }
    }

    /**
     * Handles the insertion of a printable character or sequence (like newline or tab spaces).
     * @param {string} data The character(s) to insert.
     */
    handleCharacterInput(data) {
        const oldInput = this.state.getInput()
        const oldCursor = this.state.getCursor()

        this.state.insertData(data)
        const newInput = this.state.getInput()

        // Optimization: If typing at the end, just write the char and update state simply
        if (oldCursor === oldInput.length) {
            this.renderer.write(data) // Just append character(s) visually
            // State cursor already updated by insertData
        } else {
            // If inserting in the middle, a full redraw is generally needed
            const newCursor = this.state.getCursor() // Get updated cursor from state
            this.renderer.setInputDisplay(newInput) // Redraw based on new state
            this.state.setCursor(newCursor) // Ensure state reflects final cursor after redraw
            this.renderer.updateCursorDisplay() // Make sure visual cursor matches
        }
    }
}
