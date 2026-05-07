/**
 * @file Per-Protostar key/value variable store. Each `Protostar` instance
 * owns its own bag so multiple instances on the same page do not share state.
 */

/**
 * Outcome of `VariableStore.set`. `ok: false` is returned (rather than
 * thrown) when the key was never declared, so callers can surface a friendly
 * error to the user without unwinding the component pipeline.
 */
export type SetResult =
    | { ok: true }
    | { ok: false; reason: "undeclared"; key: string }

/**
 * Holds the variables declared in a `commands.json` `variables` block, plus
 * any values written by `variable` components or prompt resolutions.
 *
 * Writes to undeclared keys are rejected — the schema requires variables to
 * be enumerated up front, and silently growing the bag at runtime would mask
 * typos in component definitions.
 */
export class VariableStore {
    private values: Record<string, string> = {}

    /** @param initial Declared variables and their starting values. */
    constructor(initial: Record<string, string> = {}) {
        for (const [k, v] of Object.entries(initial)) {
            this.values[k] = v
        }
    }

    /**
     * Read a variable.
     *
     * @param key The variable name.
     * @returns The current value, or `undefined` if the key was not declared.
     */
    get(key: string): string | undefined {
        return this.values[key]
    }

    /**
     * @param key The variable name.
     * @returns `true` iff `key` was declared, regardless of its current value.
     */
    has(key: string): boolean {
        return Object.prototype.hasOwnProperty.call(this.values, key)
    }

    /**
     * Write `value` to `key`. Returns `{ ok: false, reason: "undeclared" }`
     * if the key wasn't declared in `initial` — the call is a no-op in that
     * case. Throws nothing.
     *
     * @param key The variable name.
     * @param value The new value.
     * @returns Tagged success/rejection result.
     */
    set(key: string, value: string): SetResult {
        if (!this.has(key)) {
            return { ok: false, reason: "undeclared", key }
        }
        this.values[key] = value
        return { ok: true }
    }

    /**
     * Unconditional write — creates the key if missing, overwrites otherwise.
     * Used by prompt components to persist their resolved value under
     * `component.name`, which is by design not part of the declared bag.
     *
     * @param key The variable name.
     * @param value The new value.
     */
    define(key: string, value: string): void {
        this.values[key] = value
    }

    /**
     * Defensive copy of the current key/value map. Used by `interpolate` to
     * build the merged `{ ...variables, ...argv }` context without exposing
     * the internal record.
     *
     * @returns A new record with the same keys and values as the store.
     */
    entries(): Record<string, string> {
        return { ...this.values }
    }
}
