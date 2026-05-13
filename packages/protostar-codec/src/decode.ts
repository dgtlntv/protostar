/**
 * @file Reverses `encode`'s pipeline. Each stage's failure is wrapped
 * with the stage name so the user-facing error message identifies which
 * step blew up — that diagnostic is the user-facing trust boundary when
 * a shared link doesn't load, so its content matters.
 *
 * Returns a discriminated result rather than throwing because every call
 * site (playground boot path, CLI round-trip test) wants to render a
 * fallback or message on failure — `try`/`catch` everywhere would just
 * recreate the result type by hand.
 */

import type { Commands } from "@dgtlntv/protostar"
import { ENCODING_VERSION } from "./encode.js"
import { validateCommands } from "./validate.js"
import { decompressDeflateRaw } from "./compress.js"
import { base64urlToBytes } from "./base64url.js"

/** Successful decode — `commands` is schema-validated and safe to run. */
export type DecodeOk = { ok: true; commands: Commands }

/**
 * Failed decode. The `error` string is prefixed with the pipeline stage
 * (`base64`, `decompress`, `parse`, `validate`, `version`) so the user
 * can tell where the payload went wrong.
 */
export type DecodeErr = { ok: false; error: string }

/** Discriminated union returned by {@link decode}. */
export type DecodeResult = DecodeOk | DecodeErr

/**
 * Decode a `p1=<base64url>` payload into a `Commands` value. Accepts
 * inputs with or without a leading `#` so the caller can pass
 * `location.hash` verbatim. Returns `{ ok: false }` on every failure
 * mode — malformed key, unsupported version, garbled base64,
 * decompression error, JSON parse error, schema rejection.
 */
export async function decode(input: string): Promise<DecodeResult> {
    const stripped = input.startsWith("#") ? input.slice(1) : input
    if (stripped.length === 0) {
        return { ok: false, error: "version: empty payload" }
    }

    const eqIndex = stripped.indexOf("=")
    if (eqIndex < 1) {
        return { ok: false, error: "version: payload missing version key" }
    }

    const key = stripped.slice(0, eqIndex)
    const body = stripped.slice(eqIndex + 1)

    if (key !== ENCODING_VERSION) {
        return {
            ok: false,
            error: `unsupported encoding version: ${key}`,
        }
    }

    let bytes: Uint8Array
    try {
        bytes = base64urlToBytes(body)
    } catch (err) {
        return { ok: false, error: `base64: ${(err as Error).message}` }
    }

    let json: string
    try {
        json = await decompressDeflateRaw(bytes)
    } catch (err) {
        return { ok: false, error: `decompress: ${(err as Error).message}` }
    }

    let parsed: unknown
    try {
        parsed = JSON.parse(json)
    } catch (err) {
        return { ok: false, error: `parse: ${(err as Error).message}` }
    }

    const validated = validateCommands(parsed)
    if (!validated.ok) {
        return { ok: false, error: `validate: ${validated.error}` }
    }

    return { ok: true, commands: validated.value }
}
