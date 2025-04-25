/**
 * Provides miscellaneous stateless utility functions.
 * Includes functions for word boundary detection, coordinate calculation,
 * line counting, and input validation.
 * Based on: https://github.com/wavesoft/local-echo/blob/master/lib/Utils.js
 */

import ansiRegex from "ansi-regex"
import { parse } from "shell-quote" // Used for isIncompleteInput, keep for now

/**
 * Finds the closest word boundary to the left of a given offset.
 * @param {string} input The string to search within.
 * @param {number} offset The cursor position (index) in the string.
 * @returns {number} The index of the closest left word boundary, or 0 if none is found.
 */
export function closestLeftBoundary(input, offset) {
    const found = wordBoundaries(input, true) // Get start indices
        .reverse() // Search from right to left
        .find((x) => x < offset) // Find the first boundary strictly less than the offset
    return found == null ? 0 : found // Default to the beginning of the string
}

/**
 * Finds the closest word boundary to the right of a given offset.
 * @param {string} input The string to search within.
 * @param {number} offset The cursor position (index) in the string.
 * @returns {number} The index of the closest right word boundary, or the string length if none is found.
 */
export function closestRightBoundary(input, offset) {
    const found = wordBoundaries(input, false) // Get end indices
        .find((x) => x > offset) // Find the first boundary strictly greater than the offset
    return found == null ? input.length : found // Default to the end of the string
}

/**
 * Converts a character offset in a string to terminal column and row coordinates,
 * considering terminal width and newlines, and ignoring ANSI escape codes.
 * @param {string} input The string (potentially with ANSI codes).
 * @param {number} offset The character offset (0-based index) in the *logical* string (ANSI codes ignored).
 * @param {number} maxCols The maximum number of columns in the terminal.
 * @returns {{col: number, row: number}} The calculated column and row (0-based).
 */
export function offsetToColRow(input, offset, maxCols) {
    let row = 0
    let col = 0

    // Get the logical input string without ANSI codes for coordinate calculation
    const cleanInput = input.replace(ansiRegex(), "")
    const cleanOffset = Math.min(offset, cleanInput.length) // Ensure offset is within bounds of clean string

    for (let i = 0; i < cleanOffset; ++i) {
        const char = cleanInput.charAt(i)
        if (char === "\n") {
            col = 0
            row += 1
        } else {
            col += 1
            if (col >= maxCols) {
                // Wrap when COLUMNS are filled (>= maxCols)
                col = 0
                row += 1
            }
        }
    }

    return { row, col }
}

/**
 * Counts the number of lines the given string will occupy in the terminal,
 * considering terminal width and newlines, and ignoring ANSI escape codes.
 * @param {string} input The string (potentially with ANSI codes).
 * @param {number} maxCols The maximum number of columns in the terminal.
 * @returns {number} The total number of lines occupied.
 */
export function countLines(input, maxCols) {
    // Calculate the position of the *last* character and add 1 to get the total rows (0-based)
    const cleanInput = input.replace(ansiRegex(), "")
    if (cleanInput.length === 0) return 1 // An empty input still occupies one line initially
    return offsetToColRow(input, cleanInput.length, maxCols).row + 1
}

/**
 * Checks if the input string is considered incomplete (e.g., unterminated quotes,
 * trailing operators).
 * @param {string} input The input string to check.
 * @returns {boolean} True if the input is likely incomplete, false otherwise.
 */
export function isIncompleteInput(input) {
    // Based on original logic, uses shell-quote's parse to help detect unterminated quotes.
    // Might need refinement depending on the exact shell syntax desired.

    // Empty input is not incomplete
    if (input.trim() === "") {
        return false
    }

    try {
        // Try parsing the input. If it throws, it might be incomplete.
        // Note: `shell-quote.parse` might not catch all desired incomplete cases by itself.
        parse(input)

        // Check for dangling boolean or pipe operations (very basic check)
        if (input.trim().match(/(\&{1,2}|\|{1,2})$/)) {
            // Check if the last non-whitespace char is an operator
            const lastChar = input.trim().slice(-1)
            if (lastChar === "&" || lastChar === "|") {
                // More specific check if it ends with && or || or |
                if (
                    input.trim().endsWith("&&") ||
                    input.trim().endsWith("||") ||
                    input.trim().endsWith("|")
                ) {
                    return true
                }
            }
        }

        // Check for trailing backslash (used for line continuation)
        // Ensure it's not an escaped backslash (\\)
        if (input.endsWith("\\") && !input.endsWith("\\\\")) {
            return true
        }
    } catch (e) {
        // If parsing fails (e.g., unterminated quote), consider it incomplete
        return true
    }

    // Original checks for odd number of quotes (simpler check)
    if ((input.match(/'/g) || []).length % 2 !== 0) {
        return true
    }
    if ((input.match(/"/g) || []).length % 2 !== 0) {
        return true
    }

    return false
}
