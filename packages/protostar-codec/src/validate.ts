/**
 * @file Schema validation for `Commands` JSON. Compiles the bundled
 * `commands.schema.json` once at module load — AJV-compiled validators
 * are perf-critical and recompiling per call is a known regression
 * (a-few-hundred-µs path turns into a few-ms path).
 *
 * The validator is the trust boundary between any incoming `Commands`
 * payload (CLI stdin, decoded URL hash, programmatic caller) and the
 * Protostar runtime. Anything that reaches Protostar's component
 * dispatcher has been schema-checked here first.
 */

import Ajv, { type ErrorObject, type ValidateFunction } from "ajv"
import type { Commands } from "@dgtlntv/protostar"
import schema from "../schema/commands.schema.json"

/**
 * Successful validation result. The `value` is structurally narrowed to
 * `Commands` so call sites can use it directly without a second cast.
 */
export type ValidateOk = { ok: true; value: Commands }

/**
 * Failed validation result. The `error` string includes the AJV instance
 * path and a one-line description, formatted to be safe to surface in a
 * CLI message or terminal error line.
 */
export type ValidateErr = { ok: false; error: string }

/** Discriminated union returned by {@link validateCommands}. */
export type ValidateResult = ValidateOk | ValidateErr

const ajv = new Ajv({ allErrors: false, strict: false })
const compiledValidator: ValidateFunction = ajv.compile(schema)

/**
 * Format a single AJV error as `<instancePath>: <message>` (root path
 * normalized to `/` so the user sees something more readable than empty
 * string).
 */
function formatError(err: ErrorObject): string {
    const path = err.instancePath || "/"
    return `${path}: ${err.message ?? "validation failed"}`
}

/**
 * Validate an unknown value against the Protostar `commands.schema.json`.
 * Returns a discriminated result so call sites can handle success and
 * failure without `try`/`catch`. Schema compile happens once at module
 * load, so this call is the lookup-and-walk path only.
 */
export function validateCommands(value: unknown): ValidateResult {
    if (compiledValidator(value)) {
        return { ok: true, value: value as Commands }
    }
    const errors = compiledValidator.errors ?? []
    const error = errors.length > 0 ? formatError(errors[0]) : "unknown validation failure"
    return { ok: false, error }
}
