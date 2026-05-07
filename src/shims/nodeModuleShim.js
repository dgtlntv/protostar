/**
 * @file Browser-side stand-in for `node:module`. pi-tui's `terminal.js`
 * eagerly does `const cjsRequire = createRequire(import.meta.url)` at
 * module load. We never instantiate `ProcessTerminal`, but the call still
 * runs, so `createRequire` must resolve to a callable that returns
 * something with the same shape as a `require` function. The returned
 * `require` is a stub: any call resolves to an empty object, which is
 * sufficient because no consumer of `cjsRequire` runs in the browser.
 */

/**
 * Stand-in for `module.createRequire`. Returns a fake `require` that
 * resolves any specifier to an empty object so eager calls don't throw.
 *
 * @returns {(specifier: string) => Record<string, unknown>}
 */
export function createRequire() {
    return () => ({})
}

export default { createRequire }
