/**
 * @file Specs for `interpolate` covering testing-strategy-phase-2.md
 * §interpolate: handlebars rendering, argv-shadows-variables precedence,
 * unknown-key fallthrough, no HTML escaping.
 */

import { describe, it, expect } from "vitest"
import { interpolate } from "../../src/shell/interpolate.js"
import { VariableStore } from "../../src/shell/VariableStore.js"

describe("interpolate", () => {
    it("replaces {{var}} from the merged context", () => {
        const vars = new VariableStore({ name: "alice" })
        expect(interpolate("hi {{name}}", {}, vars)).toBe("hi alice")
    })

    it("argv keys shadow variable keys", () => {
        const vars = new VariableStore({ name: "alice" })
        expect(interpolate("hi {{name}}", { name: "bob" }, vars)).toBe(
            "hi bob"
        )
    })

    it("unknown keys render to empty string", () => {
        const vars = new VariableStore({})
        expect(interpolate("hi {{missing}}", {}, vars)).toBe("hi ")
    })

    it("works with a plain record as the variable source", () => {
        expect(interpolate("hi {{name}}", {}, { name: "alice" })).toBe(
            "hi alice"
        )
    })

    it("does not HTML-escape dynamic values", () => {
        const vars = new VariableStore({ name: "" })
        vars.set("name", "<bob>")
        expect(interpolate("hi {{name}}", {}, vars)).toBe("hi <bob>")
    })
})
