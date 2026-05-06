/**
 * @file Browser-side stand-in for `node:perf_hooks`. pi-tui's `tui.js`
 * imports `{ performance }` from `node:perf_hooks` and calls
 * `performance.now()` for render throttling. The browser ships
 * `globalThis.performance`, so we just re-export that.
 *
 * Removed in 2.G alongside the rest of the polyfill churn.
 */

export const performance = globalThis.performance

export default { performance }
