/**
 * @file Centralized chalk wrappers and status glyphs used by the component
 * layer. Single source of truth for color choices and status prefixes.
 */

import chalk from "chalk"
import { Text } from "@mariozechner/pi-tui"

/**
 * Colored status glyphs used by the spinner's conclusion line and
 * available to any component that wants a status prefix.
 */
export const LOG_SYMBOLS = {
    /** Green ✔ — successful completion. */
    success: chalk.green("✔"),
    /** Red ✖ — failure. */
    failure: chalk.red("✖"),
    /** Blue ℹ — informational. */
    info: chalk.blue("ℹ"),
    /** Yellow ⚠ — warning. */
    warning: chalk.yellow("⚠"),
} as const

/** Symbol key understood by spinner conclusions and other status prefixes. */
export type LogSymbolKind = keyof typeof LOG_SYMBOLS

/**
 * Cyan accent color used for the spinning indicator and the filled portion
 * of the progress bar.
 */
export const accentColor = chalk.cyan

/** Color used for muted/secondary text such as the loader message body. */
export const mutedColor = chalk.dim

/**
 * Build a `Text` line that occupies exactly one terminal row with no
 * surrounding gutter. pi-tui's `Text` defaults to `paddingX=1` and
 * `paddingY=1`, which adds a one-column indent and a blank row above and
 * below every line — undesirable for a shell where output should sit
 * flush against the prompt. Every shell-flow `Text` should be built via
 * this helper so the look stays consistent across modules.
 *
 * @param content Pre-rendered line (ANSI sequences allowed).
 * @returns A `Text` with both axes of padding zeroed.
 */
export function flatText(content: string): Text {
    return new Text(content, 0, 0)
}
