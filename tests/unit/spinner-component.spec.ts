/**
 * @file Specs for the `spinner` display component. Verifies conclusion
 * glyphs (`succeed`/`fail`/`stop`), single- vs multi-phrase output, and
 * `{{var}}` interpolation in phrases.
 */

import { describe, it, expect } from "vitest"
import { makeHarness, flushRender } from "./helpers/componentHarness.js"

describe("spinner component", () => {
    it("ends with the success glyph and the (last) phrase", async () => {
        const h = makeHarness()
        await h.run({
            component: "spinner",
            output: "Working",
            duration: 30,
        })
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("Working")
        expect(joined).toContain("✔")
    })

    it("ends with the failure glyph when conclusion is 'fail'", async () => {
        const h = makeHarness()
        await h.run({
            component: "spinner",
            output: "Trying",
            duration: 30,
            conclusion: "fail",
        })
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("✖")
    })

    it("emits no glyph when conclusion is 'stop'", async () => {
        const h = makeHarness()
        await h.run({
            component: "spinner",
            output: "Quiet",
            duration: 30,
            conclusion: "stop",
        })
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("Quiet")
        expect(joined).not.toContain("✔")
        expect(joined).not.toContain("✖")
    })

    it("cycles through array phrases and ends on the last one", async () => {
        const h = makeHarness({ variables: { who: "Ada" } })
        await h.run({
            component: "spinner",
            output: ["Greeting {{who}}", "Greeted {{who}}"],
            duration: 60,
        })
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("Greeted Ada")
    })
})
