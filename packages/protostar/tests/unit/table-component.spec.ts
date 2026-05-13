/**
 * @file Specs for the `table` display component. Drives `runTable`
 * end-to-end against a virtual terminal and asserts on the rendered
 * viewport: explicit colWidths, content-derived width fallback, header
 * separator, word wrap, and variable interpolation.
 */

import { describe, it, expect } from "vitest"
import { makeHarness, flushRender } from "./helpers/componentHarness.js"

/**
 * Mount one table on a fresh harness, render, and return the viewport
 * lines with trailing blank rows trimmed.
 */
async function renderTable(opts: {
    rows: string[][]
    colWidths?: number[]
    columns?: number
    variables?: Record<string, string>
}): Promise<string[]> {
    const h = makeHarness({
        columns: opts.columns ?? 80,
        variables: opts.variables,
    })
    await h.run({
        component: "table",
        output: opts.rows,
        ...(opts.colWidths ? { colWidths: opts.colWidths } : {}),
    })
    await flushRender(h.tui, h.term)
    const lines = await h.term.getViewport()
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
    return lines
}

describe("table component", () => {
    it("honors explicit colWidths", async () => {
        const lines = await renderTable({
            rows: [
                ["A", "B"],
                ["1", "2"],
            ],
            colWidths: [10, 5],
        })
        expect(lines[0]).toBe("┌" + "─".repeat(12) + "┬" + "─".repeat(7) + "┐")
    })

    it("falls back to content-derived widths when colWidths is absent", async () => {
        const lines = await renderTable({
            rows: [
                ["Name", "Age"],
                ["Ada", "36"],
            ],
        })
        // "Name" widest in column 0 (4); "Age" widest in column 1 (3).
        expect(lines[0]).toBe("┌" + "─".repeat(6) + "┬" + "─".repeat(5) + "┐")
    })

    it("inserts a header separator after the first row", async () => {
        const lines = await renderTable({
            rows: [["A"], ["1"]],
        })
        // [top, header, sep, body, bot]
        expect(lines).toHaveLength(5)
        expect(lines[2].startsWith("├")).toBe(true)
    })

    it("wraps cell content that exceeds the column width", async () => {
        const lines = await renderTable({
            rows: [["H"], ["abcdefgh"]],
            colWidths: [3],
        })
        // body rows for the wrapped cell sit between the header sep and
        // the bottom border
        const body = lines.slice(3, -1)
        expect(body.length).toBeGreaterThan(1)
    })

    it("interpolates variables in cells", async () => {
        const lines = await renderTable({
            rows: [["Name"], ["{{who}}"]],
            variables: { who: "Ada" },
        })
        expect(lines.join("\n")).toContain("Ada")
    })
})
