/**
 * @file Decoder-side guarantees: leading-`#` tolerance, version
 * gatekeeping (`p1` vs unknown), and per-stage error labelling. The
 * error strings are the user-facing diagnostic on a broken share link,
 * so their content is part of the contract — not an implementation
 * detail.
 */

import { describe, it, expect } from "vitest"
import { encode, decode } from "../src/index.js"
import type { Commands } from "@dgtlntv/protostar"

const sampleCommands: Commands = {
    welcome: "hi",
    variables: {},
    commands: {
        ping: { handler: { component: "text", output: "pong" } },
    },
}

describe("decode versioning + error surface", () => {
    it("decodes a well-formed p1 payload", async () => {
        const payload = await encode(sampleCommands)
        const result = await decode(payload)
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.commands).toEqual(sampleCommands)
        }
    })

    it("strips a leading '#' and decodes the rest", async () => {
        const payload = await encode(sampleCommands)
        const result = await decode(`#${payload}`)
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.commands).toEqual(sampleCommands)
        }
    })

    it("rejects an unknown version key with a clear message", async () => {
        const payload = await encode(sampleCommands)
        // Replace `p1=` prefix with `p2=`. Body is irrelevant; the
        // version key gates the rest of the pipeline.
        const swapped = payload.replace(/^p1=/, "p2=")
        const result = await decode(swapped)
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatch(/unsupported encoding version/)
            expect(result.error).toMatch(/p2/)
        }
    })

    it("labels base64 failure with the 'base64' stage", async () => {
        const result = await decode("p1=not!valid!base64url!")
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatch(/^base64:/)
        }
    })

    it("labels decompression failure with the 'decompress' stage", async () => {
        // base64url-encodes valid bytes that are NOT a deflate-raw
        // stream. base64url("not-a-deflate-stream") works fine through
        // the base64 stage and trips the decompressor.
        const garbage = Buffer.from("not-a-deflate-stream")
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "")
        const result = await decode(`p1=${garbage}`)
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatch(/^decompress:/)
        }
    })

    it("labels schema-validation failure with the 'validate' stage", async () => {
        // Encode a payload by walking the pipeline manually with input
        // that's well-formed JSON but not a `Commands` (nothing in the
        // shape — fails schema). Re-uses the codec's own building
        // blocks to construct the malformed input.
        const { compressDeflateRaw } = await import("../src/compress.js")
        const { bytesToBase64url } = await import("../src/base64url.js")
        const json = JSON.stringify({ commands: "not an object" })
        const compressed = await compressDeflateRaw(json)
        const payload = `p1=${bytesToBase64url(compressed)}`
        const result = await decode(payload)
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatch(/^validate:/)
        }
    })

    it("labels JSON parse failure with the 'parse' stage", async () => {
        const { compressDeflateRaw } = await import("../src/compress.js")
        const { bytesToBase64url } = await import("../src/base64url.js")
        const compressed = await compressDeflateRaw("not valid json {{{")
        const payload = `p1=${bytesToBase64url(compressed)}`
        const result = await decode(payload)
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatch(/^parse:/)
        }
    })

    it("returns a clear error on empty input", async () => {
        const result = await decode("")
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatch(/^version:/)
        }
    })

    it("returns a clear error on bare '#' (no payload)", async () => {
        const result = await decode("#")
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatch(/^version:/)
        }
    })

    it("returns a clear error when the version separator is missing", async () => {
        const result = await decode("nothings-here")
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.error).toMatch(/^version:/)
        }
    })
})
