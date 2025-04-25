/**
 * Manages the command history using a ring buffer.
 * Originally from: https://github.com/wavesoft/local-echo/blob/master/lib/HistoryController.js
 * Copyright 2018 Ioannis Charalampidis
 * Licensed under the Apache License, Version 2.0 (the "License");
 */

/**
 * Provides a ring-buffer for command history.
 */
export class History {
    constructor(size) {
        this.size = size
        this.entries = []
        this.cursor = 0
    }

    /**
     * Push an entry into the history and maintain the ring buffer size.
     * Skips empty or duplicate entries compared to the last one.
     * @param {string} entry The command string to add to history.
     */
    push(entry) {
        // Skip empty entries
        if (entry.trim() === "") return

        // Skip duplicate entries
        const lastEntry = this.entries[this.entries.length - 1]
        if (entry == lastEntry) return

        // Keep track of entries
        this.entries.push(entry)
        if (this.entries.length > this.size) {
            // Efficiently remove the oldest entry from the start
            this.entries.shift()
        }

        // Reset cursor to the end of history (the new entry)
        this.cursor = this.entries.length
    }

    /**
     * Rewind history cursor to the position after the last entry.
     * This is useful for when the user starts typing a new command.
     */
    rewind() {
        this.cursor = this.entries.length
    }

    /**
     * Returns the previous entry in the history relative to the current cursor
     * and moves the cursor back.
     * @returns {string | undefined} The previous history entry, or undefined if at the beginning.
     */
    getPrevious() {
        const newCursor = Math.max(0, this.cursor - 1)
        this.cursor = newCursor
        return this.entries[this.cursor]
    }

    /**
     * Returns the next entry in the history relative to the current cursor
     * and moves the cursor forward.
     * @returns {string | undefined} The next history entry, or undefined if at the end or past the end.
     */
    getNext() {
        const newCursor = Math.min(this.entries.length, this.cursor + 1)
        this.cursor = newCursor
        // If the cursor is past the last entry, return undefined (or an empty string to clear input)
        return this.entries[this.cursor] // Will be undefined if cursor === entries.length
    }
}
