/**
 * @file Specs for the `text` display component. Covers the assertions in
 * `.claude/testing-strategy-phase-2.md` §Display components: rendered
 * output reaches the viewport, `{{var}}` interpolation resolves against
 * argv + variables, and `duration` actually sleeps.
 */

import { describe, it, expect } from "vitest"
import { makeHarness, flushRender } from "./helpers/componentHarness.js"

describe("text component", () => {
    it("renders the interpolated output to the viewport", async () => {
        const h = makeHarness({ variables: { name: "Ada" } })
        await h.run({ component: "text", output: "Hello, {{name}}!" })
        await flushRender(h.tui, h.term)
        const lines = await h.term.getViewport()
        expect(lines.some((l) => l.includes("Hello, Ada!"))).toBe(true)
    })

    it("argv shadows variable values during interpolation", async () => {
        const h = makeHarness({
            variables: { name: "Ada" },
            argv: { name: "Grace" },
        })
        await h.run({ component: "text", output: "Hi {{name}}" })
        await flushRender(h.tui, h.term)
        const lines = await h.term.getViewport()
        expect(lines.some((l) => l.includes("Hi Grace"))).toBe(true)
    })

    it("duration sleeps before resolving", async () => {
        const h = makeHarness()
        const start = Date.now()
        await h.run({ component: "text", output: "wait", duration: 80 })
        const elapsed = Date.now() - start
        expect(elapsed).toBeGreaterThanOrEqual(70)
    })
})
