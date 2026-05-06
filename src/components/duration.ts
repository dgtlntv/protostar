/**
 * @file Helpers shared by the timed components (`text`, `progressBar`,
 * `spinner`). Centralizes the `"random"` literal handling and the small
 * promise-returning sleep so each component can stay focused on rendering.
 */

import type { Duration } from "../types/commands.js"

/**
 * Resolve a {@link Duration} to a concrete millisecond count. The literal
 * `"random"` produces a value uniformly drawn from `[100, 3000)` ms.
 *
 * @param duration A number of milliseconds, or the literal `"random"`.
 * @returns Concrete duration in milliseconds.
 */
export function resolveDuration(duration: Duration): number {
    if (duration === "random") {
        return Math.floor(Math.random() * 2900) + 100
    }
    return duration
}

/**
 * Promise-returning `setTimeout`.
 *
 * @param ms Delay in milliseconds. `0` resolves on the next macrotask.
 * @returns A promise that resolves once the timer fires.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
