/**
 * @file Bounded ring buffer for command history with cursor-based traversal.
 * Replaces the legacy `HistoryController` and fixes BUG-003 (the legacy code
 * called `entries.pop(0)` — a no-op typo of `shift()` — so overflow dropped
 * the *newest* entry instead of the oldest).
 */

/**
 * Ring buffer that records command-line history.
 *
 * Semantics inherited from the legacy controller:
 * - Empty / whitespace-only entries are ignored.
 * - Consecutive duplicates collapse to one entry; non-consecutive duplicates
 *   are kept (so `a b a` stores all three).
 * - On overflow the *oldest* entry is dropped (BUG-003 fix).
 *
 * Traversal uses an internal cursor: `getPrevious` walks backward (and pins
 * at the oldest entry), `getNext` walks forward (returning `undefined` once
 * it walks past the newest entry — that signals "back to a blank line").
 * `rewind` resets the cursor so the next `getPrevious` returns the newest.
 */
export class HistoryStore {
    private readonly capacity: number
    private entries: string[] = []
    private cursor = 0

    /** @param capacity Maximum number of entries retained. Defaults to 10. */
    constructor(capacity = 10) {
        this.capacity = capacity
    }

    /**
     * Append `entry`. Skips empty / whitespace-only inputs and consecutive
     * duplicates. On overflow the oldest entry is removed via `shift()`.
     * Resets the cursor to point past the newest entry so the next
     * `getPrevious` returns it.
     *
     * @param entry The command line just submitted.
     */
    push(entry: string): void {
        if (entry.trim() === "") return
        const last = this.entries[this.entries.length - 1]
        if (entry === last) return

        this.entries.push(entry)
        if (this.entries.length > this.capacity) {
            this.entries.shift()
        }
        this.cursor = this.entries.length
    }

    /**
     * Reset the traversal cursor so the next `getPrevious` returns the newest
     * entry. Called after the user submits a line, cancels editing, or
     * dismisses an in-progress recall.
     */
    rewind(): void {
        this.cursor = this.entries.length
    }

    /**
     * Move the cursor backward and return the entry at the new position. At
     * the oldest entry the cursor stops moving and the same value is returned
     * on subsequent calls.
     *
     * @returns The entry at the new cursor position, or `undefined` if the
     *   store is empty.
     */
    getPrevious(): string | undefined {
        const idx = Math.max(0, this.cursor - 1)
        this.cursor = idx
        return this.entries[idx]
    }

    /**
     * Move the cursor forward and return the entry at the new position. Once
     * the cursor has walked past the newest entry, returns `undefined` —
     * callers interpret that as "restore the editing buffer to blank".
     *
     * @returns The entry at the new cursor position, or `undefined` if the
     *   cursor walked past the newest entry.
     */
    getNext(): string | undefined {
        const idx = Math.min(this.entries.length, this.cursor + 1)
        this.cursor = idx
        return this.entries[idx]
    }

    /**
     * Defensive copy of the current entry list, oldest first.
     *
     * @returns A new array containing every retained entry.
     */
    snapshot(): string[] {
        return this.entries.slice()
    }
}
