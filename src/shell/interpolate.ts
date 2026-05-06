/**
 * @file Handlebars wrapper used by every component that renders text. Returns
 * the template rendered against a merged `{ ...variables, ...argv }` context
 * so command-line arguments shadow stored variables (a deviation from the
 * legacy code, which had the precedence reversed by accident).
 */

import Handlebars from "handlebars"
import type { VariableStore } from "./VariableStore.js"

/** Loose record passed in from yargs (`argv`) or any extra context. */
export type InterpolationContext = Record<string, unknown>

/**
 * Render `{{var}}` placeholders in `template` against argv merged with the
 * variable store. Argv keys take precedence on collision. Unknown keys
 * collapse to the empty string (Handlebars default). HTML escaping is
 * disabled so chalk ANSI sequences pass through untouched.
 *
 * Accepts either a `VariableStore` (uses `entries()` to snapshot) or a plain
 * record (used directly) so callers without a store — e.g. unit tests — can
 * invoke it without ceremony.
 *
 * @param template Handlebars source supplied verbatim from `commands.json`.
 * @param argv Yargs-parsed argument values. Shadows `variables` on collision.
 * @param variables Either a `VariableStore` instance or a plain record.
 * @returns The rendered string.
 */
export function interpolate(
    template: string,
    argv: InterpolationContext,
    variables: VariableStore | Record<string, unknown>
): string {
    const variableEntries =
        typeof (variables as VariableStore).entries === "function"
            ? (variables as VariableStore).entries()
            : (variables as Record<string, unknown>)
    const merged = { ...variableEntries, ...argv }
    return Handlebars.compile(template, { noEscape: true })(merged)
}
