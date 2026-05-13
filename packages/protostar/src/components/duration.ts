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
 * Promise-returning `setTimeout` with optional cancellation. When `signal`
 * is provided and aborts before the timer fires, the timer is cleared and
 * the promise resolves immediately — the resolution is intentional (not a
 * rejection) so callers don't have to wrap the await in try/catch; the
 * dispatcher inspects `signal.aborted` separately to abandon the handler.
 *
 * @param ms Delay in milliseconds. `0` resolves on the next macrotask.
 * @param signal Optional cancel signal.
 * @returns A promise that resolves once the timer fires or the signal aborts.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.resolve()
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            signal?.removeEventListener("abort", onAbort)
            resolve()
        }, ms)
        const onAbort = () => {
            clearTimeout(timer)
            resolve()
        }
        signal?.addEventListener("abort", onAbort, { once: true })
    })
}
