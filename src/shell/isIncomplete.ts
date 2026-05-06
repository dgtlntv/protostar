/**
 * @file Decides whether the user's current input line should auto-submit on
 * Enter or roll into a continuation.
 *
 * Strategy:
 *   1. Manual escape-aware quote scan — `shell-quote` silently swallows
 *      unclosed quotes instead of reporting them, so we can't lean on it
 *      for that check.
 *   2. Manual trailing-backslash check — `shell-quote` also drops a
 *      dangling `\`.
 *   3. `shell-quote.parse` to pick out the final token: if it's an op of
 *      `&&`, `||`, or `|`, the user is mid-pipeline.
 */

import { parse } from "shell-quote"

const CONTINUATION_OPS = new Set(["&&", "||", "|"])

/**
 * Test whether the input has a quote that's still open at end-of-string.
 * Honors backslash escapes (so `"it\"s"` is closed, `"hi` is not).
 *
 * @param input Raw user input.
 * @returns `true` if a `"` or `'` is still open at end-of-string.
 */
function hasUnclosedQuote(input: string): boolean {
    let quote: '"' | "'" | null = null
    for (let i = 0; i < input.length; i++) {
        const ch = input[i]
        if (ch === "\\") {
            i++
            continue
        }
        if (quote === null) {
            if (ch === '"' || ch === "'") quote = ch
        } else if (ch === quote) {
            quote = null
        }
    }
    return quote !== null
}

/**
 * Test whether `input` ends with an odd number of consecutive backslashes —
 * the trailing one is a line-continuation escape rather than a literal `\\`.
 *
 * @param input Raw user input.
 * @returns `true` if the trailing backslash is unescaped.
 */
function endsWithUnescapedBackslash(input: string): boolean {
    if (!input.endsWith("\\")) return false
    let trailing = 0
    for (let i = input.length - 1; i >= 0 && input[i] === "\\"; i--) {
        trailing++
    }
    return trailing % 2 === 1
}

/**
 * Decide whether Enter on `input` should *start a continuation line* rather
 * than submit. The empty string returns `false` (a bare Enter is always a
 * no-op submit).
 *
 * @param input Current contents of the editing buffer.
 * @returns `true` if Enter should append a newline and keep editing.
 */
export function isIncomplete(input: string): boolean {
    if (input.trim() === "") return false
    if (hasUnclosedQuote(input)) return true
    if (endsWithUnescapedBackslash(input)) return true

    const tokens = parse(input)
    const last = tokens[tokens.length - 1]
    if (
        last !== undefined &&
        typeof last === "object" &&
        last !== null &&
        "op" in last &&
        CONTINUATION_OPS.has((last as { op: string }).op)
    ) {
        return true
    }
    return false
}
