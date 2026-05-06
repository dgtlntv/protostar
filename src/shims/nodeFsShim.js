/**
 * @file Browser-side stand-in for `fs`. pi-tui's `autocomplete.js` imports
 * `readdirSync` and `statSync` to power its file-path autocomplete provider;
 * that provider is never instantiated in protostar's browser build, so the
 * imports just need to resolve to callables that don't crash if the module
 * is loaded.
 */

/** @returns {never} */
function unsupported() {
    throw new Error("fs is not available in the browser build")
}

export const readdirSync = unsupported
export const statSync = unsupported
export const appendFileSync = unsupported
export const mkdirSync = unsupported
export const writeFileSync = unsupported
export const existsSync = () => false
export const readFileSync = unsupported

export default {
    readdirSync,
    statSync,
    appendFileSync,
    mkdirSync,
    writeFileSync,
    existsSync,
    readFileSync,
}
