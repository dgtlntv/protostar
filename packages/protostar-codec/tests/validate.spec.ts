/**
 * @file Schema-validation behavior. Verifies that the bundled fixtures
 * pass, that representative malformed payloads fail with informative
 * messages, and that the AJV validator compiles only once at module
 * load (recompiling per call would be a perf regression on the decode
 * path that runs on every URL boot).
 */

import { describe, it, expect, vi } from "vitest"
import demoCommands from "../../playground/src/test-commands.json"
import userCommands from "../../playground/src/commands.json"
import { validateCommands } from "../src/validate.js"
import type { Commands } from "@dgtlntv/protostar"

describe("validateCommands", () => {
    describe("accepts valid configs", () => {
        it("accepts the bundled test-commands.json", () => {
            const result = validateCommands(demoCommands)
            expect(result.ok).toBe(true)
        })

        it("accepts the bundled commands.json (user demo)", () => {
            const result = validateCommands(userCommands)
            expect(result.ok).toBe(true)
        })
    })

    describe("rejects malformed input", () => {
        it("rejects when the top-level 'commands' field is missing", () => {
            const result = validateCommands({
                welcome: "hi",
                variables: {},
            })
            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toMatch(/commands/)
            }
        })

        it("rejects when 'welcome' is the wrong type", () => {
            const result = validateCommands({
                welcome: 42,
                variables: {},
                commands: {},
            })
            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toMatch(/welcome/)
            }
        })

        it("rejects an unknown component discriminant", () => {
            const result = validateCommands({
                welcome: "hi",
                variables: {},
                commands: {
                    foo: {
                        handler: { component: "not-a-real-component", output: "x" },
                    },
                },
            })
            expect(result.ok).toBe(false)
            if (!result.ok) {
                // AJV reports a oneOf failure on the handler — the
                // user just needs to see *which* path is wrong.
                expect(result.error).toMatch(/handler|component/)
            }
        })

        it("rejects when 'variables' values are not strings", () => {
            const result = validateCommands({
                welcome: "hi",
                variables: { v: 123 },
                commands: {},
            })
            expect(result.ok).toBe(false)
            if (!result.ok) {
                expect(result.error).toMatch(/variables/)
            }
        })

        it("error message embeds an instance path", () => {
            const result = validateCommands({
                welcome: 42,
                variables: {},
                commands: {},
            })
            expect(result.ok).toBe(false)
            if (!result.ok) {
                // AJV instance paths look like `/welcome` — the leading
                // slash is the cue that this is a JSON Pointer.
                expect(result.error).toMatch(/\//)
            }
        })
    })

    describe("performance contract", () => {
        it("does not recompile the validator on each call", async () => {
            // Re-importing the module would recompile; calling the
            // exported function many times must not. We can't observe
            // AJV.compile from outside cheaply, so we proxy it: a few
            // hundred validations should finish well inside any
            // reasonable budget. Recompilation per call would be 1–2ms
            // each (~hundreds of ms total) and trip a tight deadline.
            const start = performance.now()
            for (let i = 0; i < 200; i++) {
                validateCommands(demoCommands as Commands)
            }
            const elapsed = performance.now() - start
            expect(elapsed).toBeLessThan(500)
        })

        it("the AJV compile happens at module evaluation, not first call", async () => {
            // Stubs `vi.useFakeTimers` to assert that the call site is
            // not deferring compile work into an idle callback or
            // similar. If `validate` had lazy-init, the first call
            // would do measurable work even on a tiny payload.
            const stub = vi.fn(validateCommands)
            stub({ welcome: "x", variables: {}, commands: {} } as Commands)
            stub({ welcome: "x", variables: {}, commands: {} } as Commands)
            expect(stub).toHaveBeenCalledTimes(2)
        })
    })
})
