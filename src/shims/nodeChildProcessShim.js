/**
 * @file Browser-side stand-in for `child_process`. Same rationale as
 * {@link ./nodeFsShim.js}: pi-tui's `autocomplete.js` imports `spawn` to run
 * `fd` for the file-path provider, which is never used in the browser build.
 */

/** @returns {never} */
function unsupported() {
    throw new Error("child_process is not available in the browser build")
}

export const spawn = unsupported

export default { spawn }
