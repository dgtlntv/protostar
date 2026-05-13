/**
 * @file Specs for the `variable` display component. Asserts that declared
 * keys are mutated in the store and undeclared keys produce a visible
 * warning instead of throwing.
 */

import { describe, it, expect } from "vitest"
import { makeHarness, flushRender } from "./helpers/componentHarness.js"

describe("variable component", () => {
    it("mutates declared variables", async () => {
        const h = makeHarness({ variables: { who: "Ada" } })
        await h.run({
            component: "variable",
            output: { who: "Grace" },
        })
        expect(h.variables.get("who")).toBe("Grace")
    })

    it("renders a warning when an undeclared key is set", async () => {
        const h = makeHarness({ variables: {} })
        await h.run({
            component: "variable",
            output: { unknown: "value" },
        })
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("undeclared variable 'unknown'")
        expect(h.variables.has("unknown")).toBe(false)
    })
})
