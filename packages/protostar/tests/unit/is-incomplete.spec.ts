/**
 * @file Specs for `isIncomplete`: empty input, unclosed quotes, trailing
 * operators, trailing backslash, and escape-aware cases (e.g. an escaped
 * quote inside a string does not extend continuation).
 */

import { describe, it, expect } from "vitest"
import { isIncomplete } from "../../src/shell/isIncomplete.js"

describe("isIncomplete", () => {
    it("empty / whitespace-only input is complete", () => {
        expect(isIncomplete("")).toBe(false)
        expect(isIncomplete("   ")).toBe(false)
    })

    it("unclosed double quote is incomplete", () => {
        expect(isIncomplete('echo "hi')).toBe(true)
    })

    it("unclosed single quote is incomplete", () => {
        expect(isIncomplete("echo 'hi")).toBe(true)
    })

    it("trailing && is incomplete", () => {
        expect(isIncomplete("echo hi &&")).toBe(true)
    })

    it("trailing || is incomplete", () => {
        expect(isIncomplete("echo hi ||")).toBe(true)
    })

    it("trailing | is incomplete", () => {
        expect(isIncomplete("echo hi |")).toBe(true)
    })

    it("trailing single backslash is incomplete", () => {
        expect(isIncomplete("echo hi\\")).toBe(true)
    })

    it("escaped quote inside a string still submits", () => {
        expect(isIncomplete('echo "it\\"s"')).toBe(false)
    })

    it("escaped operator does not trigger continuation", () => {
        expect(isIncomplete("echo \\&&")).toBe(false)
    })

    it("trailing double-backslash (escaped backslash) submits", () => {
        expect(isIncomplete("echo hi\\\\")).toBe(false)
    })

    it("complete plain command submits", () => {
        expect(isIncomplete("echo hello")).toBe(false)
    })
})
