/**
 * @file Specs for `evalCondition` covering testing-strategy-phase-2.md
 * §evalCondition: each operator's result, precedence, identifier lookup, and
 * the safelist-rejection cases that the legacy `new Function(...)` would
 * have happily executed.
 */

import { describe, it, expect } from "vitest"
import {
    evalCondition,
    ConditionSyntaxError,
} from "../../src/shell/evalCondition.js"

describe("evalCondition", () => {
    describe("operators", () => {
        it("=== and !== compare strictly", () => {
            expect(evalCondition('"a" === "a"', {})).toBe(true)
            expect(evalCondition('"a" === "b"', {})).toBe(false)
            expect(evalCondition('"a" !== "b"', {})).toBe(true)
            expect(evalCondition("1 === 1", {})).toBe(true)
        })

        it("== and != compare loosely", () => {
            expect(evalCondition('"1" == 1', {})).toBe(true)
            expect(evalCondition('"1" != 2', {})).toBe(true)
            expect(evalCondition("1 != 1", {})).toBe(false)
        })

        it("&& and || are logical", () => {
            expect(evalCondition("true && true", {})).toBe(true)
            expect(evalCondition("true && false", {})).toBe(false)
            expect(evalCondition("false || true", {})).toBe(true)
            expect(evalCondition("false || false", {})).toBe(false)
        })

        it("! is unary not", () => {
            expect(evalCondition("!true", {})).toBe(false)
            expect(evalCondition("!false", {})).toBe(true)
            expect(evalCondition("!!true", {})).toBe(true)
        })
    })

    describe("precedence", () => {
        it("! binds tighter than &&", () => {
            // !false && false === (!false) && false === true && false === false
            expect(evalCondition("!false && false", {})).toBe(false)
        })

        it("&& binds tighter than ||", () => {
            // false || true && false === false || (true && false) === false
            expect(evalCondition("false || true && false", {})).toBe(false)
        })

        it("parens override precedence", () => {
            // (false || true) && false === true && false === false
            expect(evalCondition("(false || true) && false", {})).toBe(false)
        })
    })

    describe("identifier lookup", () => {
        it("looks up identifiers from the merged context", () => {
            expect(
                evalCondition('flag === "yes"', { flag: "yes" })
            ).toBe(true)
            expect(
                evalCondition('flag === "yes"', { flag: "no" })
            ).toBe(false)
        })

        it("supports number literals against identifier values", () => {
            expect(evalCondition("count === 3", { count: 3 })).toBe(true)
        })
    })

    describe("rejection", () => {
        const rejected = [
            ["function calls", "foo()"],
            ["dotted property access", "obj.prop"],
            ["assignment", "x = 1"],
            ["new operator", "new Date()"],
            ["ternary", "a ? 1 : 2"],
            ["regex literal", "/foo/.test(x)"],
        ] as const

        for (const [label, expr] of rejected) {
            it(`throws on ${label}: ${expr}`, () => {
                expect(() => evalCondition(expr, {})).toThrow(
                    ConditionSyntaxError
                )
            })
        }
    })
})
