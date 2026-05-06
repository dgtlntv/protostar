/**
 * @file Specs for `HistoryStore` covering testing-strategy-phase-2.md
 * §HistoryStore: traversal, dedupe, ring-buffer overflow (BUG-003), rewind.
 */

import { describe, it, expect } from "vitest"
import { HistoryStore } from "../../src/shell/HistoryStore.js"

describe("HistoryStore", () => {
    it("push then getPrevious walks backward", () => {
        const h = new HistoryStore(10)
        h.push("a")
        h.push("b")
        h.push("c")
        expect(h.getPrevious()).toBe("c")
        expect(h.getPrevious()).toBe("b")
        expect(h.getPrevious()).toBe("a")
        expect(h.getPrevious()).toBe("a") // pinned at oldest
    })

    it("getNext walks forward; past-newest returns undefined", () => {
        const h = new HistoryStore(10)
        h.push("a")
        h.push("b")
        h.getPrevious() // -> "b"
        h.getPrevious() // -> "a"
        expect(h.getNext()).toBe("b")
        expect(h.getNext()).toBeUndefined()
    })

    it("dedupes consecutive duplicates", () => {
        const h = new HistoryStore(10)
        h.push("a")
        h.push("a")
        h.push("a")
        expect(h.snapshot()).toEqual(["a"])
    })

    it("keeps non-consecutive duplicates", () => {
        const h = new HistoryStore(10)
        h.push("a")
        h.push("b")
        h.push("a")
        expect(h.snapshot()).toEqual(["a", "b", "a"])
    })

    it("ring buffer at overflow drops the oldest entry, not the newest (BUG-003)", () => {
        const h = new HistoryStore(3)
        h.push("a")
        h.push("b")
        h.push("c")
        h.push("d")
        expect(h.snapshot()).toEqual(["b", "c", "d"])
    })

    it("rewind resets the cursor to the length", () => {
        const h = new HistoryStore(10)
        h.push("a")
        h.push("b")
        h.getPrevious() // cursor moved
        h.rewind()
        // After rewind, getPrevious should return the newest entry again.
        expect(h.getPrevious()).toBe("b")
    })

    it("ignores empty entries", () => {
        const h = new HistoryStore(10)
        h.push("")
        h.push("   ")
        h.push("a")
        expect(h.snapshot()).toEqual(["a"])
    })
})
