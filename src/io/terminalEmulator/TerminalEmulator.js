/**
 * Main class for the terminal emulator.
 * Orchestrates state, input handling, rendering, and history management.
 * Provides the primary user-facing API (read, print, etc.).
 */

import EventEmitter from "eventemitter3"
import { History } from "./History"
import { Input } from "./Input"
import { Renderer } from "./Renderer"
import { State } from "./State"

export class TerminalEmulator extends EventEmitter {
    constructor(term = null, options = {}) {
        super()

        this.term = term
        this.historySize = options.historySize ?? 50

        // Bind methods that will be used as event listeners
        this._handleTermData = this._onTermData.bind(this)
        this._handleTermResize = this._onTermResize.bind(this)

        this.history = new History(this.historySize)
        this.state = new State(
            term?.cols ?? options.termCols ?? 80,
            term?.rows ?? options.termRows ?? 24
        )
        this.renderer = new Renderer(this.term, this.state)
        this.input = new Input(this.state, this.history, this.renderer, this)

        this._disposables = []

        if (this.term) {
            if (typeof this.term.loadAddon === "function") {
            } else {
                this.attach()
            }
        }
    }

    /**
     * Called by xterm.js when loading the addon.
     * @param {object} term The xterm.js terminal instance.
     */
    activate(term) {
        this.term = term
        this.renderer.term = term
        this.attach()
    }

    /**
     * Called by xterm.js when disposing the addon.
     */
    dispose() {
        this.detach()
        this.term = null
    }

    // --- Lifecycle & Attachment ---

    /**
     * Attaches the emulator to the terminal, listening for data and resize events.
     */
    attach() {
        if (!this.term) {
            console.error(
                "TerminalEmulator.attach: No terminal instance provided."
            )
            return
        }
        this.detach()

        // Update state with current terminal size
        this.state.setTermSize(this.term.cols, this.term.rows)

        // Register listeners and store disposables
        if (typeof this.term.onData === "function") {
            this._disposables.push(this.term.onData(this._handleTermData))
        }
        if (typeof this.term.onResize === "function") {
            this._disposables.push(this.term.onResize(this._handleTermResize))
        }

        // If there's an active prompt, make sure the state reflects it should be active
        if (this.state.getActivePrompt() || this.state.getActiveCharPrompt()) {
            this.state.setActive(true)
            this.emit("resume")
        } else {
            this.state.setActive(false)
            this.emit("pause")
        }
    }

    /**
     * Detaches the emulator from the terminal, removing event listeners.
     */
    detach() {
        if (this._disposables.length > 0) {
            this._disposables.forEach((d) => d.dispose())
            this._disposables = []
            this.state.setActive(false)
            this.emit("pause")
        }
    }

    // --- Event Handlers ---

    /** Internal handler for terminal data events. */
    _onTermData(data) {
        this.input.handleTermData(data)
    }

    /** Internal handler for terminal resize events. */
    _onTermResize({ cols, rows }) {
        this.renderer.clearInputDisplay()
        this.state.setTermSize(cols, rows)
        this.renderer.redrawInputLine()
    }

    // --- Public API ---

    /**
     * Reads a complete line of input from the user.
     * @param {string} prompt The prompt string to display for the first line.
     * @param {string} [continuationPrompt="> "] The prompt string for subsequent lines (if input is multi-line).
     * @returns {Promise<string>} A promise that resolves with the user's input line when Enter is pressed.
     */
    read(prompt, continuationPrompt = "> ") {
        return new Promise((resolve, reject) => {
            if (this.state.isActive()) {
                reject(new Error("Another read operation is already active."))
                return
            }

            this.renderer.print(prompt)
            this.state.setActivePrompt({
                prompt,
                continuationPrompt,
                resolve,
                reject,
            })
            this.state.resetInput()
            this.history.rewind()
            this.state.setActive(true)
            this.emit("resume")
        })
    }

    /**
     * Reads a single character from the user.
     * @param {string} prompt The prompt string to display.
     * @returns {Promise<string>} A promise that resolves with the single character typed by the user.
     */
    readChar(prompt) {
        return new Promise((resolve, reject) => {
            if (this.state.getActiveCharPrompt()) {
                reject(
                    new Error("Another readChar operation is already active.")
                )
                return
            }

            this.renderer.print(prompt)
            this.state.setActiveCharPrompt({
                prompt,
                resolve,
                reject,
            })

            if (!this.state.isActive()) {
                this.state.setActive(true)
                this.emit("resume")
            }
        })
    }

    /**
     * Aborts any pending read or readChar operation.
     * @param {string} [reason="aborted"] The rejection reason for the pending promise.
     */
    abortRead(reason = "aborted") {
        const activePrompt = this.state.getActivePrompt()
        const activeCharPrompt = this.state.getActiveCharPrompt()

        if (activePrompt || activeCharPrompt) {
            this.renderer.println("")
            if (activePrompt) {
                activePrompt.reject(reason)
                this.state.setActivePrompt(null)
            }
            if (activeCharPrompt) {
                activeCharPrompt.reject(reason)
                this.state.setActiveCharPrompt(null)
            }
            this.state.resetInput()
            this.state.setActive(false)
            this.emit("pause")
        }
    }

    /** Prints a message to the terminal, followed by a newline. */
    println(message) {
        this.renderer.println(message)
    }

    /** Prints a message to the terminal. */
    print(message) {
        this.renderer.print(message)
    }

    /** Prints a list of items in a wide, columnized format. */
    printWide(items, padding = 2) {
        this.renderer.printWide(items, padding)
    }

    // --- Internal Methods for Controllers ---

    /**
     * Called by Input when a line read is complete.
     * @param {string} line The completed input line.
     * @access internal
     */
    completeRead(line) {
        const activePrompt = this.state.getActivePrompt()
        if (activePrompt) {
            if (line.trim()) {
                // Only push non-empty lines to history
                this.history.push(line)
                this.emit("history", line)
            }
            activePrompt.resolve(line)
            this.state.setActivePrompt(null)
            this.state.resetInput()
            this.state.setActive(false)
            this.emit("line", line)
            this.emit("pause")
        }
    }

    /**
     * Called by Input (e.g., after Ctrl+C) to request the prompt be redisplayed if active.
     * @access internal
     */
    requestPromptDisplay() {
        if (this.state.getActivePrompt()) {
            this.renderer.print(this.state.getActivePrompt().prompt)
        } else if (this.state.getActiveCharPrompt()) {
            this.renderer.print(this.state.getActiveCharPrompt().prompt)
        }
    }
}
