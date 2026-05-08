/**
 * @file Browser-side stand-in for `os`. pi-tui's `autocomplete.js` calls
 * `homedir()` from its file-path autocomplete provider; that provider never
 * runs in protostar's browser build, so a callable returning a placeholder
 * path is sufficient.
 */

/** @returns {string} */
export function homedir() {
    return "/"
}

export default { homedir }
