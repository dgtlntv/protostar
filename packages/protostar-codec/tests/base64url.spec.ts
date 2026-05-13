/**
 * @file Round-trip and alphabet behavior of the URL-safe base64 codec.
 * Covers each padding case (n%3 = 0/1/2), the absence of `+`/`/`/`=` in
 * outputs, lenient padding on decode, and rejection of non-alphabet
 * input. The compress + URL-loader pipelines depend on this layer being
 * exact, so the cases are exhaustive about edges (empty buffer, single
 * byte, multibyte string) rather than just spot-checking happy paths.
 */

import { describe, it, expect } from "vitest"
import {
    bytesToBase64url,
    base64urlToBytes,
} from "../src/base64url.js"

function ascii(s: string): Uint8Array {
    return new TextEncoder().encode(s)
}

describe("base64url", () => {
    describe("bytesToBase64url + base64urlToBytes round-trip", () => {
        it("round-trips an empty buffer", () => {
            const bytes = new Uint8Array()
            expect(bytesToBase64url(bytes)).toBe("")
            expect(base64urlToBytes("")).toEqual(bytes)
        })

        it("round-trips a single byte (n%3 = 1)", () => {
            const bytes = new Uint8Array([0x4d])
            const encoded = bytesToBase64url(bytes)
            expect(encoded).toMatch(/^[A-Za-z0-9_\-]+$/)
            expect(base64urlToBytes(encoded)).toEqual(bytes)
        })

        it("round-trips two bytes (n%3 = 2)", () => {
            const bytes = new Uint8Array([0x4d, 0x61])
            const encoded = bytesToBase64url(bytes)
            expect(base64urlToBytes(encoded)).toEqual(bytes)
        })

        it("round-trips three bytes (n%3 = 0)", () => {
            const bytes = new Uint8Array([0x4d, 0x61, 0x6e])
            const encoded = bytesToBase64url(bytes)
            expect(base64urlToBytes(encoded)).toEqual(bytes)
        })

        it("round-trips ASCII string content", () => {
            const bytes = ascii("Hello, world!")
            expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes)
        })

        it("round-trips UTF-8 multibyte content", () => {
            const bytes = ascii("café — naïve résumé 日本語")
            expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes)
        })

        it("round-trips bytes including null and high values", () => {
            const bytes = new Uint8Array([0, 1, 2, 254, 255, 0, 0, 127])
            expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes)
        })
    })

    describe("URL-safe alphabet", () => {
        it("output never contains '+', '/', or '='", () => {
            // Inputs chosen because their standard-base64 form is known to
            // contain `+` (`>`) and `/` (`?`) characters — confirms the
            // substitution and padding-strip happen.
            const inputs = [
                new Uint8Array([0xfb, 0xff, 0xff]),
                new Uint8Array([0x3e, 0x3f, 0x40]),
                ascii("subjects?"),
                ascii("a"),
                ascii("ab"),
            ]
            for (const bytes of inputs) {
                const encoded = bytesToBase64url(bytes)
                expect(encoded).not.toMatch(/[+/=]/)
            }
        })

        it("substitutes '+' → '-' and '/' → '_'", () => {
            // `[0xfb, 0xff, 0xff]` encodes to `+///` in standard base64.
            expect(bytesToBase64url(new Uint8Array([0xfb, 0xff, 0xff]))).toBe("-___")
        })
    })

    describe("decode leniency", () => {
        it("accepts input with trailing '=' padding", () => {
            const bytes = ascii("Ma")
            const encoded = bytesToBase64url(bytes)
            const padded = encoded + "=".repeat((4 - (encoded.length % 4)) % 4)
            expect(base64urlToBytes(padded)).toEqual(bytes)
        })

        it("accepts input without padding", () => {
            const bytes = ascii("Ma")
            expect(base64urlToBytes(bytesToBase64url(bytes))).toEqual(bytes)
        })
    })

    describe("decode rejects invalid input", () => {
        it("throws on '+' (standard-base64 char outside the URL alphabet)", () => {
            expect(() => base64urlToBytes("ab+d")).toThrow(/alphabet/)
        })

        it("throws on '/' (standard-base64 char outside the URL alphabet)", () => {
            expect(() => base64urlToBytes("ab/d")).toThrow(/alphabet/)
        })

        it("throws on whitespace and punctuation", () => {
            expect(() => base64urlToBytes("ab d")).toThrow(/alphabet/)
            expect(() => base64urlToBytes("ab.d")).toThrow(/alphabet/)
        })
    })
})
