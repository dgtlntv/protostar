/**
 * Copyright 2018 Ioannis Charalampidis
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Key changes:
 * - Extended EventEmitter functionality for better event handling
 * - Replaced direct ANSI codes with ansiEscapes library
 * - Added new terminal control methods
 * - Improved cursor navigation and input handling
 * - Fixed edge cases in prompt management
 *
 * Original repository: https://github.com/wavesoft/local-echo/blob/master/lib/LocalEchoController.js
 */

import ansiEscapes from "ansi-escapes"
import ansiRegex from "ansi-regex"
import EventEmitter from "eventemitter3"
import { HistoryController } from "./HistoryController"
import {
    closestLeftBoundary,
    closestRightBoundary,
    collectAutocompleteCandidates,
    countLines,
    decodeANSIKeypressData,
    getLastToken,
    getSharedFragment,
    hasTailingWhitespace,
    isIncompleteInput,
    offsetToColRow,
} from "./Utils"

/**
 * A local terminal controller is responsible for displaying messages
 * and handling local echo for the terminal.
 *
 * Local echo supports most of bash-like input primitives. Namely:
 * - Arrow navigation on the input
 * - Alt-arrow for word-boundary navigation
 * - Alt-backspace for word-boundary deletion
 * - Multi-line input for incomplete commands
 * - Auto-complete hooks
 */
export default class LocalEchoController extends EventEmitter {
    constructor(term = null, options = {}) {
        super()
        this.term = term
        this._handleTermData = this.handleTermData.bind(this)
        this._handleTermResize = this.handleTermResize.bind(this)

        this.history = new HistoryController(options.historySize || 10)
        this.maxAutocompleteEntries = options.maxAutocompleteEntries || 100

        this._autocompleteHandlers = []
        this._active = false
        this._input = ""
        this._cursor = 0
        this._activePrompt = null
        this._activeCharPrompt = null
        this._termSize = {
            cols: 0,
            rows: 0,
        }

        this._disposables = []

        if (term) {
            if (term.loadAddon) term.loadAddon(this)
            else this.attach()
        }

        if (typeof globalThis !== "undefined" && !globalThis.localEcho) {
            globalThis.localEcho = this
        }
    }

    // xterm.js new plugin API:
    activate(term) {
        this.term = term
        this.attach()
    }
    dispose() {
        this.detach()
    }

    /////////////////////////////////////////////////////////////////////////////
    // User-Facing API
    /////////////////////////////////////////////////////////////////////////////

    /**
     *  Detach the controller from the terminal
     */
    detach() {
        this._disposables.forEach((d) => d.dispose())
        this._disposables = []

        this.emit("pause")
    }

    /**
     * Attach controller to the terminal, handling events
     */
    attach() {
        this._disposables.push(this.term.onData(this._handleTermData))
        this._disposables.push(this.term.onResize(this._handleTermResize))

        this._termSize = {
            cols: this.term.cols,
            rows: this.term.rows,
        }

        this.emit("resume")
    }

    /**
     * Register a handler that will be called to satisfy auto-completion
     */
    addAutocompleteHandler(fn, ...args) {
        this._autocompleteHandlers.push({
            fn,
            args,
        })
    }

    /**
     * Remove a previously registered auto-complete handler
     */
    removeAutocompleteHandler(fn) {
        const idx = this._autocompleteHandlers.findIndex((e) => e.fn === fn)
        if (idx === -1) return

        this._autocompleteHandlers.splice(idx, 1)
    }

    /**
     * Return a promise that will resolve when the user has completed
     * typing a single line
     */
    read(prompt, continuationPrompt = "> ") {
        return new Promise((resolve, reject) => {
            this.term.write(prompt)
            this._activePrompt = {
                prompt,
                continuationPrompt,
                resolve,
                reject,
            }

            this._input = ""
            this._cursor = 0
            this._active = true
            this.emit("resume")
        })
    }

    /**
     * Return a promise that will be resolved when the user types a single
     * character.
     *
     * This can be active in addition to `.read()` and will be resolved in
     * priority before it.
     */
    readChar(prompt) {
        return new Promise((resolve, reject) => {
            this.term.write(prompt)
            this._activeCharPrompt = {
                prompt,
                resolve,
                reject,
            }
        })
    }

    /**
     * Abort a pending read operation
     */
    abortRead(reason = "aborted") {
        if (this._activePrompt != null || this._activeCharPrompt != null) {
            this.term.write("\r\n")
        }
        if (this._activePrompt != null) {
            this._activePrompt.reject(reason)
            this._activePrompt = null
        }
        if (this._activeCharPrompt != null) {
            this._activeCharPrompt.reject(reason)
            this._activeCharPrompt = null
        }
        this._active = false
        this.emit("pause")
    }

    /**
     * Prints a message and changes line
     */
    println(message) {
        this.print(message + "\n")
    }

    /**
     * Prints a message and properly handles new-lines
     */
    print(message) {
        this.term.write(message)
    }

    /**
     * Prints a list of items using a wide-format
     */
    printWide(items, padding = 2) {
        if (items.length == 0) return println("")

        // Compute item sizes and matrix row/cols
        const itemWidth =
            items.reduce((width, item) => Math.max(width, item.length), 0) +
            padding
        const wideCols = Math.floor(this._termSize.cols / itemWidth)
        const wideRows = Math.ceil(items.length / wideCols)

        // Print matrix
        let i = 0
        for (let row = 0; row < wideRows; ++row) {
            let rowStr = ""

            // Prepare columns
            for (let col = 0; col < wideCols; ++col) {
                if (i < items.length) {
                    let item = items[i++]
                    item += " ".repeat(itemWidth - item.length)
                    rowStr += item
                }
            }
            this.println(rowStr)
        }
    }

    /////////////////////////////////////////////////////////////////////////////
    // Internal API
    /////////////////////////////////////////////////////////////////////////////

    /**
     * Apply prompts to the given input
     */
    applyPrompts(input) {
        const prompt = this?._activePrompt?.prompt || ""
        const continuationPrompt = this?._activePrompt?.continuationPrompt || ""

        return prompt + input.replace(/\n/g, "\n" + continuationPrompt)
    }

    /**
     * Advances the `offset` as required in order to accompany the prompt
     * additions to the input.
     */
    applyPromptOffset(input, offset) {
        const newInput = this.applyPrompts(input.substr(0, offset))
        return newInput.replace(ansiRegex(), "").length
    }

    /**
     * Clears the current prompt
     *
     * This function will erase all the lines that display the current prompt
     * and move the cursor in the beginning of the first line of the prompt.
     */
    clearInput() {
        const currentPrompt = this.applyPrompts(this._input)

        // Get the overall number of lines to clear
        const allRows = countLines(currentPrompt, this._termSize.cols)

        // Get the line we are currently in
        const promptCursor = this.applyPromptOffset(this._input, this._cursor)
        const { col, row } = offsetToColRow(
            currentPrompt,
            promptCursor,
            this._termSize.cols
        )

        // First move on the last line
        const moveRows = allRows - row - 1
        for (var i = 0; i < moveRows; ++i)
            this.term.write(ansiEscapes.cursorNextLine)

        // Clear current input line(s)
        this.term.write(ansiEscapes.cursorLeft + ansiEscapes.eraseEndLine)
        for (var i = 1; i < allRows; ++i)
            this.term.write(
                ansiEscapes.cursorPrevLine + ansiEscapes.eraseEndLine
            )
    }

    clearTerminal() {
        this.term.write(ansiEscapes.clearTerminal)
    }

    /**
     * Replace input with the new input given
     *
     * This function clears all the lines that the current input occupies and
     * then replaces them with the new input.
     */
    setInput(newInput, clearInput = true) {
        // Clear current input
        if (clearInput) this.clearInput()

        // Write the new input lines, including the current prompt
        const newPrompt = this.applyPrompts(newInput)

        this.print(newPrompt)

        // Trim cursor overflow
        if (this._cursor > newInput.length) {
            this._cursor = newInput.length
        }

        // Move the cursor to the appropriate row/col
        const newCursor = this.applyPromptOffset(newInput, this._cursor)
        const newLines = countLines(newPrompt, this._termSize.cols)

        const { col, row } = offsetToColRow(
            newPrompt,
            newCursor,
            this._termSize.cols
        )

        const moveUpRows = newLines - row - 1

        this.term.write(ansiEscapes.cursorLeft)
        for (var i = 0; i < moveUpRows; ++i)
            this.term.write(ansiEscapes.cursorPrevLine)

        if (col !== 0) this.term.write(ansiEscapes.cursorForward(col))

        // Replace input
        this._input = newInput
    }

    /**
     * This function completes the current input, calls the given callback
     * and then re-displays the prompt.
     */
    printAndRestartPrompt(callback) {
        const cursor = this._cursor

        // Complete input
        this.setCursor(this._input.length)
        this.term.write("\r\n")

        // Prepare a function that will resume prompt
        const resume = () => {
            this._cursor = cursor
            this.setInput(this._input)
        }

        // Call the given callback to echo something, and if there is a promise
        // returned, wait for the resolution before resuming prompt.
        const ret = callback()
        if (ret == null) {
            resume()
        } else {
            ret.then(resume)
        }
    }

    /**
     * Set the new cursor position, as an offset on the input string
     *
     * This function:
     * - Calculates the previous and current
     */
    setCursor(newCursor) {
        if (newCursor < 0) newCursor = 0
        if (newCursor > this._input.length) newCursor = this._input.length

        // Apply prompt formatting to get the visual status of the display
        const inputWithPrompt = this.applyPrompts(this._input)
        const inputLines = countLines(inputWithPrompt, this._termSize.cols)

        // Estimate previous cursor position
        const prevPromptOffset = this.applyPromptOffset(
            this._input,
            this._cursor
        )
        const { col: prevCol, row: prevRow } = offsetToColRow(
            inputWithPrompt,
            prevPromptOffset,
            this._termSize.cols
        )

        // Estimate next cursor position
        const newPromptOffset = this.applyPromptOffset(this._input, newCursor)
        const { col: newCol, row: newRow } = offsetToColRow(
            inputWithPrompt,
            newPromptOffset,
            this._termSize.cols
        )

        // Adjust vertically
        if (newRow > prevRow) {
            for (let i = prevRow; i < newRow; ++i)
                this.term.write(ansiEscapes.cursorDown())
        } else {
            for (let i = newRow; i < prevRow; ++i)
                this.term.write(ansiEscapes.cursorUp())
        }

        // Adjust horizontally
        if (newCol > prevCol) {
            for (let i = prevCol; i < newCol; ++i)
                this.term.write(ansiEscapes.cursorForward())
        } else {
            for (let i = newCol; i < prevCol; ++i)
                this.term.write(ansiEscapes.cursorBackward())
        }

        // Set new offset
        this._cursor = newCursor
    }

    /**
     * Move cursor at given direction
     */
    handleCursorMove(dir) {
        if (dir > 0) {
            const num = Math.min(dir, this._input.length - this._cursor)
            this.setCursor(this._cursor + num)
        } else if (dir < 0) {
            const num = Math.max(dir, -this._cursor)
            this.setCursor(this._cursor + num)
        }
    }

    /**
     * Set the cursor position absolute
     */
    cursorTo(x = null, y = null) {
        if (x !== null && y !== null) {
            this.term.write(ansiEscapes.cursorTo(x, y))
        } else if (x !== null) {
            this.term.write(ansiEscapes.cursorTo(x))
        } else if (y !== null) {
            this.term.write(ansiEscapes.cursorTo(0, y))
        }
    }

    /**
     * Set the cursor position relative to its current position
     */
    moveCursor(x = null, y = null) {
        if (x !== null && y !== null) {
            this.term.write(ansiEscapes.cursorMove(x, y))
        } else if (x !== null) {
            this.term.write(ansiEscapes.cursorMove(x))
        } else if (y !== null) {
            this.term.write(ansiEscapes.cursorMove(0, y))
        }
    }

    /**
     * Erase a character at cursor location
     */
    handleCursorErase(backspace) {
        const { _cursor, _input } = this
        if (backspace) {
            if (_cursor <= 0) return
            const newInput =
                _input.substr(0, _cursor - 1) + _input.substr(_cursor)
            this.clearInput()
            this._cursor -= 1
            this.setInput(newInput, false)
        } else {
            const newInput =
                _input.substr(0, _cursor) + _input.substr(_cursor + 1)
            this.setInput(newInput)
        }
    }

    /**
     * Set the current activePrompt
     */
    setPrompt(prompt, continuationPrompt = "> ") {
        if (this._activePrompt) {
            this._activePrompt.prompt = prompt
            this._activePrompt.continuationPrompt = continuationPrompt
        } else {
            this._activePrompt = {
                prompt,
                continuationPrompt,
                resolve: null,
                reject: null,
            }
        }
    }

    /**
     * Get the current activePrompt
     */
    getPrompt() {
        return this._activePrompt
            ? {
                  prompt: this._activePrompt.prompt,
                  continuationPrompt: this._activePrompt.continuationPrompt,
              }
            : null
    }

    /**
     * Insert character at cursor location
     */
    handleCursorInsert(data) {
        const { _cursor, _input } = this
        const newInput =
            _input.substr(0, _cursor) + data + _input.substr(_cursor)
        this._cursor += data.length
        this.setInput(newInput)
    }

    /**
     * Handle input completion
     */
    handleReadComplete() {
        if (this.history) {
            this.history.push(this._input)
            this.emit("history")
        }
        if (this._activePrompt) {
            this._activePrompt.resolve(this._input)
            this._activePrompt = null
        }
        this.term.write("\r\n")
        this._active = false
        this.emit("line", this._input)
        this.emit("pause")
    }

    /**
     * Handle terminal resize
     *
     * This function clears the prompt using the previous configuration,
     * updates the cached terminal size information and then re-renders the
     * input. This leads (most of the times) into a better formatted input.
     */
    handleTermResize(data) {
        const { rows, cols } = data
        this.clearInput()
        this._termSize = { cols, rows }
        this.setInput(this._input, false)
    }

    /**
     * Handle terminal input
     */
    handleTermData(data) {
        if (!this._active) {
            // If we have an active character prompt, satisfy it in priority
            if (this._activeCharPrompt != null) {
                this._activeCharPrompt.resolve(data)
                this._activeCharPrompt = null
                this.term.write("\r\n")
                return
            }
        }

        // If this looks like a pasted input, expand it
        if (data.length > 3 && data.charCodeAt(0) !== 0x1b) {
            const normData = data.replace(/[\r\n]+/g, "\r")
            Array.from(normData).forEach((c) => this.decodeTermData(c))
        } else {
            this.decodeTermData(data)
        }
    }

    /**
     * Handle a single piece of information from the terminal.
     */
    decodeTermData(data) {
        const { ch, key } = decodeANSIKeypressData(data)

        // If active we let LocalEchoController handle the keypress.
        // If not we emit a keypress event so eg. the prompt library
        // can use the keypresses for its purposes.
        if (this._active) {
            this.handleActiveInput(ch, key)
        } else {
            this.emit("keypress", ch, key)
        }
    }

    /**
     * Handle input when the terminal is active
     */
    handleActiveInput(data, key) {
        let ofs

        switch (key?.name) {
            case "up":
                if (this.history) {
                    let value = this.history.getPrevious()
                    if (value) {
                        this.setInput(value)
                        this.setCursor(value.length)
                    }
                }
                break

            case "down":
                if (this.history) {
                    let value = this.history.getNext()
                    if (!value) value = ""
                    this.setInput(value)
                    this.setCursor(value.length)
                }
                break

            case "left":
                if (key.meta) {
                    ofs = closestLeftBoundary(this._input, this._cursor)
                    if (ofs != null) this.setCursor(ofs)
                } else {
                    this.handleCursorMove(-1)
                }
                break

            case "right":
                if (key.meta) {
                    ofs = closestRightBoundary(this._input, this._cursor)
                    if (ofs != null) this.setCursor(ofs)
                } else {
                    this.handleCursorMove(1)
                }
                break

            case "delete":
                this.handleCursorErase(false)
                break

            case "end":
                this.setCursor(this._input.length)
                break

            case "home":
                this.setCursor(0)
                break

            case "backspace":
                if (key.ctrl) {
                    ofs = closestLeftBoundary(this._input, this._cursor)
                    if (ofs != null) {
                        this.setInput(
                            this._input.substr(0, ofs) +
                                this._input.substr(this._cursor)
                        )
                        this.setCursor(ofs)
                    }
                } else {
                    this.handleCursorErase(true)
                }
                break

            case "enter":
                if (isIncompleteInput(this._input)) {
                    this.handleCursorInsert("\n")
                } else {
                    this.handleReadComplete()
                }
                break

            case "tab":
                if (this._autocompleteHandlers.length > 0) {
                    const inputFragment = this._input.substr(0, this._cursor)
                    const hasTailingSpace = hasTailingWhitespace(inputFragment)
                    const candidates = collectAutocompleteCandidates(
                        this._autocompleteHandlers,
                        inputFragment
                    )

                    // Sort candidates
                    candidates.sort()

                    // Depending on the number of candidates, we are handling them in
                    // a different way.
                    if (candidates.length === 0) {
                        // No candidates? Just add a space if there is none already
                        if (!hasTailingSpace) {
                            this.handleCursorInsert(" ")
                        }
                    } else if (candidates.length === 1) {
                        // Just a single candidate? Complete
                        const lastToken = getLastToken(inputFragment)
                        this.handleCursorInsert(
                            candidates[0].substr(lastToken.length) + " "
                        )
                    } else if (
                        candidates.length <= this.maxAutocompleteEntries
                    ) {
                        // search for a shared fragment
                        const sameFragment = getSharedFragment(
                            inputFragment,
                            candidates
                        )

                        // if there's a shared fragment between the candidates
                        // print complete the shared fragment
                        if (sameFragment) {
                            const lastToken = getLastToken(inputFragment)
                            this.handleCursorInsert(
                                sameFragment.substr(lastToken.length)
                            )
                        }

                        // If we are less than maximum auto-complete candidates, print
                        // them to the user and re-start prompt
                        this.printAndRestartPrompt(() => {
                            this.printWide(candidates)
                        })
                    } else {
                        // If we have more than maximum auto-complete candidates, print
                        // them only if the user acknowledges a warning
                        this.printAndRestartPrompt(() =>
                            this.readChar(
                                `Display all ${candidates.length} possibilities? (y or n)`
                            ).then((yn) => {
                                if (yn == "y" || yn == "Y") {
                                    this.printWide(candidates)
                                }
                            })
                        )
                    }
                } else {
                    this.handleCursorInsert("    ")
                }
                break

            case "c":
                if (key.ctrl) {
                    this.setCursor(this._input.length)
                    this.term.write(
                        "^C\r\n" + ((this._activePrompt || {}).prompt || "")
                    )
                    this._input = ""
                    this._cursor = 0
                    if (this.history) this.history.rewind()

                    this.emit("SIGINT")
                } else {
                    this.handleCursorInsert(data)
                }
                break

            default:
                this.handleCursorInsert(data)
                break
        }
    }

    /////////////////////////////////////////////////////////////////////////////
    // ANSI Escape commands
    /////////////////////////////////////////////////////////////////////////////

    /**
     * Move cursor up a specific amount of rows
     */
    cursorUp(count = 1) {
        this.term.write(ansiEscapes.cursorUp(count))
    }

    /**
     * Move cursor down a specific amount of rows
     */
    cursorDown(count = 1) {
        this.term.write(ansiEscapes.cursorDown(count))
    }

    /**
     * Move cursor forward a specific amount of columns
     */
    cursorForward(count = 1) {
        this.term.write(ansiEscapes.cursorForward(count))
    }

    /**
     * Move cursor backward a specific amount of columns
     */
    cursorBackward(count = 1) {
        this.term.write(ansiEscapes.cursorBackward(count))
    }

    /**
     * Move cursor to the left side
     */
    cursorLeft() {
        this.term.write(ansiEscapes.cursorLeft)
    }

    /**
     * Save cursor position + settings
     */
    cursorSavePosition() {
        this.term.write(ansiEscapes.cursorSavePosition)
    }

    /**
     * Restore last cursor position + settings
     */
    cursorRestorePosition() {
        this.term.write(ansiEscapes.cursorRestorePosition)
    }

    /**
     * Get cursor position.
     */
    cursorGetPosition() {
        this.term.write(ansiEscapes.cursorRestorePosition)
    }

    /**
     * Move cursor to the next line
     */
    cursorNextLine() {
        this.term.write(ansiEscapes.cursorNextLine)
    }

    /**
     * Move cursor to the previous line
     */
    cursorPrevLine() {
        this.term.write(ansiEscapes.cursorPrevLine)
    }

    /**
     * Hide the cursor
     */
    cursorHide() {
        this.term.write(ansiEscapes.cursorHide)
    }

    /**
     * Show the cursor
     */
    cursorShow() {
        this.term.write(ansiEscapes.cursorShow)
    }

    /**
     * Erase from the current cursor position up the specified amount of rows.
     */
    clearLines(count) {
        this.term.write(ansiEscapes.eraseLines(count))
    }

    /**
     * Erase from the current cursor position to the end of the current line
     */
    clearEndLine() {
        this.term.write(ansiEscapes.eraseEndLine)
    }

    /**
     * Erase from the current cursor position to the start of the current line
     */
    clearStartLine() {
        this.term.write(ansiEscapes.eraseStartLine)
    }

    /**
     * Erase the entire current line
     */
    clearLine(direction = 0) {
        switch (direction) {
            case -1:
                this.term.write(ansiEscapes.eraseStartLine)
                break
            case 1:
                this.term.write(ansiEscapes.eraseEndLine)
                break
            case 0:
            default:
                this.term.write(ansiEscapes.eraseLine)
                break
        }
    }

    /**
     * Erase the screen from the current line down to the bottom of the screen
     */
    clearScreenDown() {
        this.term.write(ansiEscapes.eraseDown)
    }

    /**
     * Erase the screen from the current line up to the top of the screen
     */
    clearScreenUp() {
        this.term.write(ansiEscapes.eraseUp)
    }

    /**
     * Erase the screen and move the cursor the top left position
     */
    eraseScreen() {
        this.term.write(ansiEscapes.eraseScreen)
    }

    /**
     * Scroll display up one line
     */
    scrollUp() {
        this.term.write(ansiEscapes.scrollUp)
    }

    /**
     * Scroll display down one line
     */
    scrollDown() {
        this.term.write(ansiEscapes.scrollDown)
    }

    /**
     * Clear the terminal screen. (Viewport)
     */
    clearScreen() {
        this.term.write(ansiEscapes.clearScreen)
    }

    /**
     * Output a beeping sound
     */
    beep() {
        this.term.write(ansiEscapes.beep)
    }

    /**
     * Create a clickable link.
     */
    link(text, url) {
        return ansiEscapes.link(text, url)
    }
}
