/**
 * @file `{{var}}` template interpolation. Renders a template against a
 * merged `{ ...variables, ...argv }` context so command-line arguments
 * shadow stored variables. Unknown keys collapse to the empty string.
 *
 * The grammar is intentionally narrow — every template in `commands.json`
 * uses only the plain `{{varname}}` form, so a regex replacer covers the
 * full surface without pulling in a templating engine. Whitespace inside
 * the braces is permitted (`{{ var }}` works); helpers, blocks, and
 * dotted property access are not — they fall through as a literal lookup
 * by the whole inner string and resolve to empty on miss.
 */

import type { VariableStore } from "./VariableStore.js"

/** Loose record passed in from yargs (`argv`) or any extra context. */
export type InterpolationContext = Record<string, unknown>

/** Matches `{{ key }}` with optional surrounding whitespace; captures `key`. */
const PLACEHOLDER = /\{\{\s*([^\s}]+)\s*\}\}/g

/**
 * @param variables Either a `VariableStore` or a plain record.
 * @returns The variable entries as a plain record.
 */
function entriesOf(
    variables: VariableStore | Record<string, unknown>
): Record<string, unknown> {
    return typeof (variables as VariableStore).entries === "function"
        ? (variables as VariableStore).entries()
        : (variables as Record<string, unknown>)
}

/**
 * Render `{{var}}` placeholders in `template` against argv merged with the
 * variable store. Argv keys take precedence on collision. Unknown keys
 * collapse to the empty string. No HTML escaping — chalk ANSI sequences
 * pass through untouched.
 *
 * @param template Source supplied verbatim from `commands.json`.
 * @param argv Yargs-parsed argument values. Shadows `variables` on collision.
 * @param variables Either a `VariableStore` instance or a plain record.
 * @returns The rendered string.
 */
export function interpolate(
    template: string,
    argv: InterpolationContext,
    variables: VariableStore | Record<string, unknown>
): string {
    const ctx = { ...entriesOf(variables), ...argv }
    return template.replace(PLACEHOLDER, (_match, key: string) => {
        const value = ctx[key]
        return value === undefined || value === null ? "" : String(value)
    })
}
