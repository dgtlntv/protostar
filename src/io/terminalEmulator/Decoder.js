/**
 * Decodes raw terminal data (potentially ANSI sequences) into a character
 * and a key object describing the key press (name, ctrl, meta, shift).
 *
 * Based on Node.js internal TTY keypress decoder:
 * https://github.com/nodejs/node/blob/main/lib/internal/tty.js (_keypressDecoder)
 * Copyright Joyent, Inc. and other Node contributors. MIT License.
 *
 * @param {string | Buffer} s The raw data sequence from the terminal.
 * @returns {{ch: string | undefined, key: {name: string | undefined, ctrl: boolean, meta: boolean, shift: boolean, sequence: string, code?: string} | undefined}}
 *          An object containing the printable character (if any) and a key descriptor object.
 */
export function decodeANSIKeypressData(s) {
    let key = {
        name: undefined,
        ctrl: false,
        meta: false,
        shift: false,
        sequence: typeof s === "string" ? s : s.toString("utf-8"), // Store original sequence
    }
    let ch = undefined
    let parts

    // Ensure s is a string for processing
    const sequence = key.sequence

    if (sequence === "\r" || sequence === "\n") {
        // Some terminals send \n for Enter
        key.name = "enter"
    } else if (sequence === "\t") {
        key.name = "tab"
    } else if (
        sequence === "\b" || // Backspace
        sequence === "\x7f" || // Delete or Backspace (VT220)
        sequence === "\x1b\x7f" || // Meta+Backspace (sometimes)
        sequence === "\x1b\b" // Meta+Backspace (sometimes)
    ) {
        key.name = "backspace"
        key.meta = sequence.charAt(0) === "\x1b"
    } else if (sequence === "\x1b" || sequence === "\x1b\x1b") {
        key.name = "escape"
        key.meta = sequence.length === 2
    } else if (sequence === " " || sequence === "\x1b ") {
        key.name = "space"
        key.meta = sequence.length === 2
    } else if (sequence.length === 1 && sequence <= "\x1a") {
        // Control character sequence (C0 control codes)
        key.name = String.fromCharCode(
            sequence.charCodeAt(0) + "a".charCodeAt(0) - 1
        )
        key.ctrl = true
    } else if (sequence.length === 1 && sequence >= "a" && sequence <= "z") {
        // Lowercase letter
        key.name = sequence
        ch = sequence
    } else if (sequence.length === 1 && sequence >= "A" && sequence <= "Z") {
        // Uppercase letter
        key.name = sequence.toLowerCase()
        key.shift = true
        ch = sequence
    } else if ((parts = /^(?:\x1b)([a-zA-Z0-9])$/.exec(sequence))) {
        // Meta+Character sequence (e.g., Alt+a)
        key.name = parts[1].toLowerCase()
        key.meta = true
        key.shift = /^[A-Z]$/.test(parts[1])
        // Note: meta sequences don't typically produce a printable character `ch`
    } else if (
        (parts =
            /^(?:\x1b+)(O|N|\[|\[\[)(?:(\d+)(?:;(\d+))?([~^$])|(?:1;)?(\d+)?([a-zA-Z]))/.exec(
                sequence
            ))
    ) {
        // ANSI escape sequence (e.g., arrows, function keys, home, end)
        const code =
            (parts[1] || "") +
            (parts[2] || "") +
            (parts[4] || "") +
            (parts[6] || "")
        const modifier = parseInt(parts[3] || parts[5] || "1", 10) - 1

        // Parse modifiers
        key.ctrl = !!(modifier & 4)
        key.meta = !!(modifier & 10) // Meta (Alt) can be complex, this covers common cases
        key.shift = !!(modifier & 1)
        key.code = code // Store the core sequence code

        switch (code) {
            // Arrow Keys
            case "[A":
            case "OA":
                key.name = "up"
                break
            case "[B":
            case "OB":
                key.name = "down"
                break
            case "[C":
            case "OC":
                key.name = "right"
                break
            case "[D":
            case "OD":
                key.name = "left"
                break

            // Home/End
            case "[1~":
            case "[7~":
            case "[H":
            case "OH":
                key.name = "home"
                break
            case "[4~":
            case "[8~":
            case "[F":
            case "OF":
                key.name = "end"
                break

            // Insert/Delete
            case "[2~":
            case "[2$":
            case "[2^":
                key.name = "insert"
                break
            case "[3~":
            case "[3$":
            case "[3^":
                key.name = "delete"
                break

            // Page Up/Down
            case "[5~":
            case "[[5~":
            case "[5$":
            case "[5^":
                key.name = "pageup"
                break
            case "[6~":
            case "[[6~":
            case "[6$":
            case "[6^":
                key.name = "pagedown"
                break

            // Function Keys (simplified common cases)
            case "OP":
            case "[11~":
            case "[[A":
                key.name = "f1"
                break
            case "OQ":
            case "[12~":
            case "[[B":
                key.name = "f2"
                break
            case "OR":
            case "[13~":
            case "[[C":
                key.name = "f3"
                break
            case "OS":
            case "[14~":
            case "[[D":
                key.name = "f4"
                break
            case "[15~":
            case "[[E":
                key.name = "f5"
                break
            case "[17~":
                key.name = "f6"
                break
            case "[18~":
                key.name = "f7"
                break
            case "[19~":
                key.name = "f8"
                break
            case "[20~":
                key.name = "f9"
                break
            case "[21~":
                key.name = "f10"
                break
            case "[23~":
                key.name = "f11"
                break
            case "[24~":
                key.name = "f12"
                break

            // Shift+Tab
            case "[Z":
                key.name = "tab"
                key.shift = true
                break

            // Less common modified keys (examples)
            case "[a":
                key.name = "up"
                key.shift = true
                break
            case "[b":
                key.name = "down"
                key.shift = true
                break
            case "[c":
                key.name = "right"
                key.shift = true
                break
            case "[d":
                key.name = "left"
                key.shift = true
                break
            case "Oa":
                key.name = "up"
                key.ctrl = true
                break
            case "Ob":
                key.name = "down"
                key.ctrl = true
                break
            case "Oc":
                key.name = "right"
                key.ctrl = true
                break
            case "Od":
                key.name = "left"
                key.ctrl = true
                break

            default:
                key.name = "undefined"
                break // Unknown sequence
        }
    } else if (sequence.length === 1) {
        // Likely a single printable character not covered above (e.g., symbols)
        ch = sequence
    } else if (sequence.length > 1 && sequence[0] === "\x1b") {
        // Other potential Meta sequences (e.g., Alt + symbol), treat as meta + second char
        key.meta = true
        // We often don't get a separate 'name' for these, the app might inspect sequence[1]
        // For simplicity here, we won't assign a name unless it was matched above.
        // Let's try to set the name based on the second character if it's simple
        if (sequence.length === 2) {
            const secondChar = sequence[1]
            if (secondChar >= " " && secondChar <= "~") {
                // Printable ASCII
                key.name = secondChar.toLowerCase() // Treat Alt+A same as Alt+a for name
                // We might want to keep 'ch' undefined for meta keys
            }
        }
    }

    // If no specific key name was determined, but we have a printable char, use that
    if (key.name === undefined && ch !== undefined) {
        key.name = ch
    }

    // Ensure key object is returned only if a name was found or it's a known non-named sequence like simple escape
    if (key.name !== undefined || key.sequence === "\x1b") {
        return { ch, key }
    } else if (ch) {
        // If it's just a character with no special key meaning
        return { ch, key: undefined }
    } else {
        // Unrecognized sequence
        return { ch: undefined, key: undefined }
    }
}
