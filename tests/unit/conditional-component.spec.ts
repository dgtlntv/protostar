/**
 * @file Specs for the `conditional` display component. Verifies branch
 * selection against the merged argv+variables context, the no-op when the
 * `else` branch is absent, and recursion into a list-shaped branch.
 */

import { describe, it, expect } from "vitest"
import { makeHarness, flushRender } from "./helpers/componentHarness.js"
import type { Component } from "../../src/types/commands.js"

describe("conditional component", () => {
    it("runs `then` when the expression is truthy", async () => {
        const h = makeHarness({ variables: { who: "Ada" } })
        const conditional: Component = {
            component: "conditional",
            output: {
                if: "who === 'Ada'",
                then: { component: "text", output: "match" },
                else: { component: "text", output: "miss" },
            },
        }
        await h.run(conditional)
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("match")
        expect(joined).not.toContain("miss")
    })

    it("runs `else` when the expression is falsy", async () => {
        const h = makeHarness({ variables: { who: "Bob" } })
        const conditional: Component = {
            component: "conditional",
            output: {
                if: "who === 'Ada'",
                then: { component: "text", output: "match" },
                else: { component: "text", output: "miss" },
            },
        }
        await h.run(conditional)
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("miss")
        expect(joined).not.toContain("match")
    })

    it("is a no-op when the expression is falsy and `else` is absent", async () => {
        const h = makeHarness({ variables: { who: "Bob" } })
        const conditional: Component = {
            component: "conditional",
            output: {
                if: "who === 'Ada'",
                then: { component: "text", output: "match" },
            },
        }
        await h.run(conditional)
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).not.toContain("match")
    })

    it("recurses into an array-shaped branch", async () => {
        const h = makeHarness({ argv: { v: 1 } })
        const conditional: Component = {
            component: "conditional",
            output: {
                if: "v === 1",
                then: [
                    { component: "text", output: "first" },
                    { component: "text", output: "second" },
                ],
            },
        }
        await h.run(conditional)
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("first")
        expect(joined).toContain("second")
    })
})
