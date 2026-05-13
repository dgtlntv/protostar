/**
 * @file Specs for the `progressBar` display component. Verifies that the
 * label is interpolated, the bar reaches 100% by the end of `duration`,
 * and the label appears in the rendered viewport.
 */

import { describe, it, expect } from "vitest"
import { makeHarness, flushRender } from "./helpers/componentHarness.js"

describe("progressBar component", () => {
    it("reaches 100% by the end of the duration", async () => {
        const h = makeHarness({ variables: { task: "Indexing" } })
        await h.run({
            component: "progressBar",
            output: "{{task}}",
            duration: 60,
        })
        await flushRender(h.tui, h.term)
        const lines = await h.term.getViewport()
        const joined = lines.join("\n")
        expect(joined).toMatch(/Indexing/)
        expect(joined).toMatch(/100%/)
    })
})
