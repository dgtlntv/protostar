/**
 * Copyright [yyyy] [name of copyright owner]
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
 */

import { parse } from "shell-quote"
import ansiRegex from "ansi-regex"

/**
 * Detects all the word boundaries on the given input
 */
export function wordBoundaries(input, leftSide = true) {
    let match
    const words = []
    const rx = /\w+/g

    while ((match = rx.exec(input))) {
        if (leftSide) {
            words.push(match.index)
        } else {
            words.push(match.index + match[0].length)
        }
    }

    return words
}

/**
 * The closest left (or right) word boundary of the given input at the
 * given offset.
 */
export function closestLeftBoundary(input, offset) {
    const found = wordBoundaries(input, true)
        .reverse()
        .find((x) => x < offset)
    return found == null ? 0 : found
}
export function closestRightBoundary(input, offset) {
    const found = wordBoundaries(input, false).find((x) => x > offset)
    return found == null ? input.length : found
}

/**
 * Convert offset at the given input to col/row location
 *
 * This function is not optimized and practically emulates via brute-force
 * the navigation on the terminal, wrapping when they reach the column width.
 */
export function offsetToColRow(input, offset, maxCols) {
    let row = 0,
        col = 0

    input = input.replace(ansiRegex(), "")

    for (let i = 0; i < offset; ++i) {
        const chr = input.charAt(i)
        if (chr == "\n") {
            col = 0
            row += 1
        } else {
            col += 1
            if (col > maxCols) {
                col = 0
                row += 1
            }
        }
    }

    return { row, col }
}

/**
 * Counts the lines in the given input
 */
export function countLines(input, maxCols) {
    return (
        offsetToColRow(input, input.replace(ansiRegex(), "").length, maxCols)
            .row + 1
    )
}

/**
 * Checks if there is an incomplete input
 *
 * An incomplete input is considered:
 * - An input that contains unterminated single quotes
 * - An input that contains unterminated double quotes
 * - An input that ends with "\"
 * - An input that has an incomplete boolean shell expression (&& and ||)
 * - An incomplete pipe expression (|)
 */
export function isIncompleteInput(input) {
    // Empty input is not incomplete
    if (input.trim() == "") {
        return false
    }

    // Check for dangling single-quote strings
    if ((input.match(/'/g) || []).length % 2 !== 0) {
        return true
    }
    // Check for dangling double-quote strings
    if ((input.match(/"/g) || []).length % 2 !== 0) {
        return true
    }
    // Check for dangling boolean or pipe operations
    if (
        input
            .split(/(\|\||\||&&)/g)
            .pop()
            .trim() == ""
    ) {
        return true
    }
    // Check for tailing slash
    if (input.endsWith("\\") && !input.endsWith("\\\\")) {
        return true
    }

    return false
}

/**
 * Returns true if the expression ends on a tailing whitespace
 */
export function hasTailingWhitespace(input) {
    return input.match(/[^\\][ \t]$/m) != null
}

/**
 * Returns the last expression in the given input
 */
export function getLastToken(input) {
    // Empty expressions
    if (input.trim() === "") return ""
    if (hasTailingWhitespace(input)) return ""

    // Last token
    const tokens = parse(input)
    return tokens.pop() || ""
}

/**
 * Returns the auto-complete candidates for the given input
 */
export function collectAutocompleteCandidates(callbacks, input) {
    const tokens = parse(input)
    let index = tokens.length - 1
    let expr = tokens[index] || ""

    // Empty expressions
    if (input.trim() === "") {
        index = 0
        expr = ""
    } else if (hasTailingWhitespace(input)) {
        // Expressions with danging space
        index += 1
        expr = ""
    }

    // Collect all auto-complete candidates from the callbacks
    const all = callbacks.reduce((candidates, { fn, args }) => {
        try {
            return candidates.concat(fn(index, tokens, ...args))
        } catch (e) {
            console.error("Auto-complete error:", e)
            return candidates
        }
    }, [])

    // Filter only the ones starting with the expression
    return all.filter((txt) => txt.startsWith(expr))
}

export function getSharedFragment(fragment, candidates) {
    // end loop when fragment length = first candidate length
    if (fragment.length >= candidates[0].length) return fragment

    // save old fragemnt
    const oldFragment = fragment

    // get new fragment
    fragment += candidates[0].slice(fragment.length, fragment.length + 1)

    for (let i = 0; i < candidates.length; i++) {
        // return null when there's a wrong candidate
        if (!candidates[i].startsWith(oldFragment)) return null

        if (!candidates[i].startsWith(fragment)) {
            return oldFragment
        }
    }

    return getSharedFragment(fragment, candidates)
}

export function decodeANSIKeypressData(s) {
    /*
    // Copyright Joyent, Inc. and other Node contributors.
    //
    // Permission is hereby granted, free of charge, to any person obtaining a
    // copy of this software and associated documentation files (the
    // "Software"), to deal in the Software without restriction, including
    // without limitation the rights to use, copy, modify, merge, publish,
    // distribute, sublicense, and/or sell copies of the Software, and to permit
    // persons to whom the Software is furnished to do so, subject to the
    // following conditions:
    //
    // The above copyright notice and this permission notice shall be included
    // in all copies or substantial portions of the Software.
    //
    // THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
    // OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    // MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
    // NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
    // DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
    // OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
    // USE OR OTHER DEALINGS IN THE SOFTWARE.

    // Inspiration for this code comes from Salvatore Sanfilippo's linenoise.
    // https://github.com/antirez/linenoise
    // Reference:
    // * http://invisible-island.net/xterm/ctlseqs/ctlseqs.html
    // * http://www.3waylabs.com/nw/WWW/products/wizcon/vt220.html
    */

    /*
    Some patterns seen in terminal key escape codes, derived from combos seen
    at http://www.midnight-commander.org/browser/lib/tty/key.c

    ESC letter
    ESC [ letter
    ESC [ modifier letter
    ESC [ 1 ; modifier letter
    ESC [ num char
    ESC [ num ; modifier char
    ESC O letter
    ESC O modifier letter
    ESC O 1 ; modifier letter
    ESC N letter
    ESC [ [ num ; modifier char
    ESC [ [ 1 ; modifier letter
    ESC ESC [ num char
    ESC ESC O letter

    - char is usually ~ but $ and ^ also happen with rxvt
    - modifier is 1 +
                    (shift     * 1) +
                    (left_alt  * 2) +
                    (ctrl      * 4) +
                    (right_alt * 8)
    - two leading ESCs apparently mean the same as one leading ESC
    */

    // Regexes used for ansi escape code splitting
    var metaKeyCodeRe = /^(?:\x1b)([a-zA-Z0-9])$/
    var functionKeyCodeRe =
        /^(?:\x1b+)(O|N|\[|\[\[)(?:(\d+)(?:;(\d+))?([~^$])|(?:1;)?(\d+)?([a-zA-Z]))/

    var ch,
        key = {
            name: undefined,
            ctrl: false,
            meta: false,
            shift: false,
        },
        parts

    if (Buffer.isBuffer(s)) {
        if (s[0] > 127 && s[1] === undefined) {
            s[0] -= 128
            s = "\x1b" + s.toString("utf-8")
        } else {
            s = s.toString("utf-8")
        }
    }

    key.sequence = s

    if (s === "\r" || s === "\n") {
        // enter
        key.name = "enter"
    } else if (s === "\t") {
        // tab
        key.name = "tab"
    } else if (
        s === "\b" ||
        s === "\x7f" ||
        s === "\x1b\x7f" ||
        s === "\x1b\b"
    ) {
        // backspace or ctrl+h
        key.name = "backspace"
        key.meta = s.charAt(0) === "\x1b"
    } else if (s === "\x1b" || s === "\x1b\x1b") {
        // escape key
        key.name = "escape"
        key.meta = s.length === 2
    } else if (s === " " || s === "\x1b ") {
        key.name = "space"
        key.meta = s.length === 2
    } else if (s <= "\x1a") {
        // ctrl+letter
        key.name = String.fromCharCode(s.charCodeAt(0) + "a".charCodeAt(0) - 1)
        key.ctrl = true
    } else if (s.length === 1 && s >= "a" && s <= "z") {
        // lowercase letter
        key.name = s
    } else if (s.length === 1 && s >= "A" && s <= "Z") {
        // shift+letter
        key.name = s.toLowerCase()
        key.shift = true
    } else if ((parts = metaKeyCodeRe.exec(s))) {
        // meta+character key
        key.name = parts[1].toLowerCase()
        key.meta = true
        key.shift = /^[A-Z]$/.test(parts[1])
    } else if ((parts = functionKeyCodeRe.exec(s))) {
        // ansi escape sequence

        // reassemble the key code leaving out leading \x1b's,
        // the modifier key bitflag and any meaningless "1;" sequence
        var code =
                (parts[1] || "") +
                (parts[2] || "") +
                (parts[4] || "") +
                (parts[6] || ""),
            modifier = (parts[3] || parts[5] || 1) - 1

        // Parse the key modifier
        key.ctrl = !!(modifier & 4)
        key.meta = !!(modifier & 10)
        key.shift = !!(modifier & 1)
        key.code = code

        // Parse the key itself
        switch (code) {
            /* xterm/gnome ESC O letter */
            case "OP":
                key.name = "f1"
                break
            case "OQ":
                key.name = "f2"
                break
            case "OR":
                key.name = "f3"
                break
            case "OS":
                key.name = "f4"
                break

            /* xterm/rxvt ESC [ number ~ */
            case "[11~":
                key.name = "f1"
                break
            case "[12~":
                key.name = "f2"
                break
            case "[13~":
                key.name = "f3"
                break
            case "[14~":
                key.name = "f4"
                break

            /* from Cygwin and used in libuv */
            case "[[A":
                key.name = "f1"
                break
            case "[[B":
                key.name = "f2"
                break
            case "[[C":
                key.name = "f3"
                break
            case "[[D":
                key.name = "f4"
                break
            case "[[E":
                key.name = "f5"
                break

            /* common */
            case "[15~":
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

            /* xterm ESC [ letter */
            case "[A":
                key.name = "up"
                break
            case "[B":
                key.name = "down"
                break
            case "[C":
                key.name = "right"
                break
            case "[D":
                key.name = "left"
                break
            case "[E":
                key.name = "clear"
                break
            case "[F":
                key.name = "end"
                break
            case "[H":
                key.name = "home"
                break

            /* xterm/gnome ESC O letter */
            case "OA":
                key.name = "up"
                break
            case "OB":
                key.name = "down"
                break
            case "OC":
                key.name = "right"
                break
            case "OD":
                key.name = "left"
                break
            case "OE":
                key.name = "clear"
                break
            case "OF":
                key.name = "end"
                break
            case "OH":
                key.name = "home"
                break

            /* xterm/rxvt ESC [ number ~ */
            case "[1~":
                key.name = "home"
                break
            case "[2~":
                key.name = "insert"
                break
            case "[3~":
                key.name = "delete"
                break
            case "[4~":
                key.name = "end"
                break
            case "[5~":
                key.name = "pageup"
                break
            case "[6~":
                key.name = "pagedown"
                break

            /* putty */
            case "[[5~":
                key.name = "pageup"
                break
            case "[[6~":
                key.name = "pagedown"
                break

            /* rxvt */
            case "[7~":
                key.name = "home"
                break
            case "[8~":
                key.name = "end"
                break

            /* rxvt keys with modifiers */
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
            case "[e":
                key.name = "clear"
                key.shift = true
                break

            case "[2$":
                key.name = "insert"
                key.shift = true
                break
            case "[3$":
                key.name = "delete"
                key.shift = true
                break
            case "[5$":
                key.name = "pageup"
                key.shift = true
                break
            case "[6$":
                key.name = "pagedown"
                key.shift = true
                break
            case "[7$":
                key.name = "home"
                key.shift = true
                break
            case "[8$":
                key.name = "end"
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
            case "Oe":
                key.name = "clear"
                key.ctrl = true
                break

            case "[2^":
                key.name = "insert"
                key.ctrl = true
                break
            case "[3^":
                key.name = "delete"
                key.ctrl = true
                break
            case "[5^":
                key.name = "pageup"
                key.ctrl = true
                break
            case "[6^":
                key.name = "pagedown"
                key.ctrl = true
                break
            case "[7^":
                key.name = "home"
                key.ctrl = true
                break
            case "[8^":
                key.name = "end"
                key.ctrl = true
                break

            /* misc. */
            case "[Z":
                key.name = "tab"
                key.shift = true
                break
            default:
                key.name = "undefined"
                break
        }
    }

    // Don't emit a key if no name was found
    if (key.name === undefined) {
        key = undefined
    }

    if (s.length === 1) {
        ch = s
    }

    if (key || ch) {
        return { ch, key }
    }
}
