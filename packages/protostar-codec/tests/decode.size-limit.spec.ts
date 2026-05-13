/**
 * @file Streaming decompressed-size cap on `decode`. A pathological
 * payload — a few KB compressed, hundreds of KB decompressed — must fail
 * fast with a `size limit` diagnostic before the full output ever
 * materializes. We construct the input ourselves with our own
 * `compressDeflateRaw`, so nothing exploit-grade is in the repo or
 * exercised at test time.
 */

import { describe, it, expect } from "vitest"
import {
    compressDeflateRaw,
    bytesToBase64url,
    decode,
    MAX_DECOMPRESSED_BYTES,
} from "../src/index.js"

describe("decode — decompressed-size cap", () => {
    it(
        "rejects payloads that decompress past MAX_DECOMPRESSED_BYTES",
        async () => {
            // 1.5× the cap of repeated bytes compresses to a few KB but
            // expands well past the limit. The streaming check aborts
            // mid-flow, so this never holds the full decompressed buffer.
            const oversized = "A".repeat(MAX_DECOMPRESSED_BYTES + MAX_DECOMPRESSED_BYTES / 2)
            const compressed = await compressDeflateRaw(oversized)
            const payload = `p1=${bytesToBase64url(compressed)}`

            const start = performance.now()
            const result = await decode(payload)
            const elapsed = performance.now() - start

            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toMatch(/^decompress:/)
                expect(result.error).toMatch(/size limit/)
            }
            // Streaming abort should fail well before the bomb expands —
            // 100 ms is loose enough for slow CI but tight enough that a
            // regression to "decompress everything, then check" is loud.
            expect(elapsed).toBeLessThan(100)
        }
    )

    it("accepts payloads at or under the cap", async () => {
        // Exactly at the cap should still decompress (the check is
        // strictly greater-than).
        const atCap = "B".repeat(MAX_DECOMPRESSED_BYTES)
        const compressed = await compressDeflateRaw(atCap)
        const payload = `p1=${bytesToBase64url(compressed)}`

        const result = await decode(payload)
        // The payload is well-formed bytes but the decompressed body is
        // not a valid `Commands`, so we expect a validate-stage failure
        // (not a decompress failure). That confirms we got past the size
        // gate.
        expect(result.ok).toBe(false)
        if (!result.ok) {
            // Either parse: (not JSON) or validate: — depending on the
            // body. The point is: no `decompress: …size limit…`.
            expect(result.error).not.toMatch(/size limit/)
        }
    })
})
