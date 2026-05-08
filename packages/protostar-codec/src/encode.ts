/**
 * @file Serializes a `Commands` value to a hash-fragment payload. The
 * pipeline is `validate → JSON.stringify → deflate-raw → base64url` and
 * the output is always prefixed with the `p1=` version key so future
 * format changes (different compression, different alphabet) can swap to
 * `p2=` without breaking links already in the wild.
 *
 * Validation runs first so authors get a clear "this prototype is
 * malformed" error before they ever see compression or encoding output —
 * that ordering matters for the CLI's stderr messages.
 */

import type { Commands } from "@dgtlntv/protostar"
import { validateCommands } from "./validate.js"
import { compressDeflateRaw } from "./compress.js"
import { bytesToBase64url } from "./base64url.js"

/** Wire format version. Bumped when the encoded byte layout changes. */
export const ENCODING_VERSION = "p1"

/**
 * Encode a `Commands` value into a `p1=<base64url>` payload string.
 * Throws on schema-invalid input with the AJV path/message attached so
 * callers can render it directly. The caller composes the final URL
 * (e.g., `${origin}${pathname}#${payload}`); this function never deals
 * in URL prefixes itself.
 */
export async function encode(commands: Commands): Promise<string> {
    const result = validateCommands(commands)
    if (!result.ok) {
        throw new Error(`invalid commands: ${result.error}`)
    }
    const json = JSON.stringify(result.value)
    const compressed = await compressDeflateRaw(json)
    const payload = bytesToBase64url(compressed)
    return `${ENCODING_VERSION}=${payload}`
}
