/**
 * @file Specs for `VariableStore` covering testing-strategy-phase-2.md
 * §VariableStore: round-trip, undeclared-key rejection, snapshot copy.
 */

import { describe, it, expect } from "vitest"
import { VariableStore } from "../../src/shell/VariableStore.js"

describe("VariableStore", () => {
    it("set / get round-trips a value on a declared key", () => {
        const v = new VariableStore({ name: "" })
        const result = v.set("name", "alice")
        expect(result.ok).toBe(true)
        expect(v.get("name")).toBe("alice")
    })

    it("set on an undeclared key reports rejection without throwing", () => {
        const v = new VariableStore({ declared: "" })
        const result = v.set("undeclared", "x")
        expect(result.ok).toBe(false)
        if (!result.ok) {
            expect(result.reason).toBe("undeclared")
            expect(result.key).toBe("undeclared")
        }
        expect(v.get("undeclared")).toBeUndefined()
    })

    it("entries() returns the snapshot used by interpolate", () => {
        const v = new VariableStore({ a: "1", b: "2" })
        v.set("a", "x")
        const snap = v.entries()
        expect(snap).toEqual({ a: "x", b: "2" })
        // Snapshot is a copy, mutations don't leak back.
        snap.a = "leaked"
        expect(v.get("a")).toBe("x")
    })

    it("has() reflects declaration state", () => {
        const v = new VariableStore({ a: "" })
        expect(v.has("a")).toBe(true)
        expect(v.has("b")).toBe(false)
    })
})
