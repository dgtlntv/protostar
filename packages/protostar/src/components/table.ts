/**
 * @file `table` component. Renders a bordered table with a header row,
 * content-derived column widths (or an explicit `colWidths` override),
 * character-level wrap when a cell is wider than its column, and
 * viewport-aware downscaling so the table fits the current terminal width.
 */

import { visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui"
import type { Component } from "@earendil-works/pi-tui"
import type { TableComponent } from "../types/commands.js"
import { interpolate } from "../shell/interpolate.js"
import type { ComponentContext } from "./context.js"

const MIN_COLUMN_WIDTH = 3
const CELL_PADDING = 2 // one space each side
const BORDER_WIDTH = 1
const CORNER_WIDTH = 1

/**
 * Scale `colWidths` down to fit in `maxWidth` cells (accounting for borders
 * and per-cell padding). Each column's lower bound is {@link MIN_COLUMN_WIDTH}.
 *
 * @param colWidths Desired widths in priority order.
 * @param maxWidth Total horizontal budget in cells.
 * @returns A new array of scaled widths.
 */
function scaleColumnWidths(colWidths: number[], maxWidth: number): number[] {
    const columnCount = colWidths.length
    const totalPadding = CELL_PADDING * columnCount
    const totalBorderWidth = BORDER_WIDTH * (columnCount + 1)
    const availableWidth =
        maxWidth - totalPadding - totalBorderWidth - 2 * CORNER_WIDTH
    const totalContentWidth = colWidths.reduce((sum, w) => sum + w, 0)

    if (totalContentWidth > availableWidth && availableWidth > 0) {
        const scaleFactor = availableWidth / totalContentWidth
        return colWidths.map((w) =>
            Math.max(MIN_COLUMN_WIDTH, Math.floor(w * scaleFactor))
        )
    }
    return colWidths.map((w) => Math.max(MIN_COLUMN_WIDTH, w))
}

/**
 * Pad `text` on the right with spaces so its visible width equals
 * `targetWidth`. If `text` is already at or beyond the target, it is
 * returned unchanged.
 *
 * @param text Cell content (may contain ANSI escapes).
 * @param targetWidth Desired visible width.
 * @returns The padded string.
 */
function padRight(text: string, targetWidth: number): string {
    const w = visibleWidth(text)
    if (w >= targetWidth) return text
    return text + " ".repeat(targetWidth - w)
}

/**
 * Wrap a single cell to fit `width`. Delegates to pi-tui's
 * `wrapTextWithAnsi` so ANSI color escapes survive the wrap.
 *
 * @param cell Cell content.
 * @param width Column inner width in cells.
 * @returns One or more lines for the cell.
 */
function wrapCell(cell: string, width: number): string[] {
    if (width <= 0) return [""]
    const wrapped = wrapTextWithAnsi(cell, width)
    return wrapped.length > 0 ? wrapped : [""]
}

/**
 * Render the full table — top border, header row, header separator, body
 * rows, bottom border — using box-drawing characters.
 *
 * @param rows Interpolated cell contents. Row 0 is the header.
 * @param widths Concrete inner widths per column.
 * @returns Array of rendered lines.
 */
function renderTable(rows: string[][], widths: number[]): string[] {
    const top = "┌" + widths.map((w) => "─".repeat(w + 2)).join("┬") + "┐"
    const sep = "├" + widths.map((w) => "─".repeat(w + 2)).join("┼") + "┤"
    const bot = "└" + widths.map((w) => "─".repeat(w + 2)).join("┴") + "┘"

    const lines: string[] = [top]
    rows.forEach((row, rowIdx) => {
        const wrappedCells = row.map((cell, i) => wrapCell(cell, widths[i]))
        const height = Math.max(...wrappedCells.map((c) => c.length))
        for (let r = 0; r < height; r++) {
            const segments = wrappedCells.map((cellLines, i) => {
                const text = cellLines[r] ?? ""
                return ` ${padRight(text, widths[i])} `
            })
            lines.push("│" + segments.join("│") + "│")
        }
        if (rowIdx === 0) lines.push(sep)
    })
    lines.push(bot)
    return lines
}

/**
 * pi-tui Component that re-renders the table on each render cycle so column
 * widths track the live viewport width.
 */
class TableComponentImpl implements Component {
    /**
     * @param rows Interpolated cell contents (header + body).
     * @param colWidthsOverride Optional explicit widths from the schema.
     */
    constructor(
        private readonly rows: string[][],
        private readonly colWidthsOverride: number[] | undefined
    ) {}

    /** Required by pi-tui's `Component`; this component caches nothing. */
    invalidate(): void {}

    /**
     * Compute fitted column widths against the current viewport and render.
     *
     * @param width Live terminal column count from the TUI.
     * @returns Lines making up the rendered table.
     */
    render(width: number): string[] {
        const columnCount = this.rows[0]?.length ?? 0
        if (columnCount === 0) return []

        let widths: number[]
        if (this.colWidthsOverride) {
            widths = scaleColumnWidths([...this.colWidthsOverride], width)
        } else {
            widths = new Array<number>(columnCount).fill(0)
            for (const row of this.rows) {
                for (let i = 0; i < columnCount; i++) {
                    const w = visibleWidth(row[i] ?? "")
                    if (w > widths[i]) widths[i] = w
                }
            }
            widths = scaleColumnWidths(widths, width)
        }
        return renderTable(this.rows, widths)
    }
}

/**
 * Mount a table on `ctx.tui`. Resolves immediately — the table is static
 * once added.
 *
 * @param component The table component definition.
 * @param ctx Shared execution context.
 * @returns A promise that resolves once the table is mounted.
 */
// eslint-disable-next-line @typescript-eslint/require-await -- conforms to the async component-runner interface
export async function runTable(
    component: TableComponent,
    ctx: ComponentContext
): Promise<void> {
    const interpolated = component.output.map((row) =>
        row.map((cell) => interpolate(cell, ctx.argv, ctx.variables))
    )
    ctx.tui.addChild(
        new TableComponentImpl(interpolated, component.colWidths)
    )
    ctx.tui.requestRender()
}
