/**
 * @file Base64url codec — the URL-safe variant of base64 (RFC 4648 §5)
 * with `+`/`/` swapped for `-`/`_` and trailing `=` padding stripped. Used
 * to make a compressed binary payload safe to carry in a URL hash.
 *
 * Implementation goes through `btoa`/`atob` to keep the codec
 * dependency-free and runtime-portable: both are available globals in
 * Node 18+ and every modern browser, so the same module ships in the
 * library bundle and the Node CLI without a fork.
 */

/**
 * Encode a byte buffer to a base64url string. Output contains only
 * characters from the URL-safe alphabet (`A-Z`, `a-z`, `0-9`, `-`, `_`)
 * and never contains padding (`=`).
 */
export function bytesToBase64url(bytes: Uint8Array): string {
    let binary = ""
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i])
    }
    const b64 = btoa(binary)
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

/**
 * Decode a base64url string into bytes. The input is expected to use the
 * URL-safe alphabet; padding is optional (lenient input). Throws on any
 * character outside the alphabet so the caller can map the failure into
 * a clear pipeline error.
 */
export function base64urlToBytes(input: string): Uint8Array {
    if (!/^[A-Za-z0-9_\-]*=*$/.test(input)) {
        throw new Error("base64url input contains characters outside the alphabet")
    }
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/")
    const padLength = (4 - (b64.length % 4)) % 4
    const padded = b64 + "=".repeat(padLength)
    const binary = atob(padded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}
