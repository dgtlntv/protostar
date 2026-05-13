/**
 * @file Browser-side stand-in for `path`. pi-tui's `autocomplete.js` and
 * `terminal.js`/`tui.js` import path helpers; only the autocomplete provider
 * actively uses them at runtime, and that provider is unused in the browser
 * build. The exports just need to be callable.
 */

/** @returns {string} */
export function basename(p, ext) {
    if (typeof p !== "string") return ""
    const base = p.split("/").pop() ?? ""
    if (ext && base.endsWith(ext)) return base.slice(0, -ext.length)
    return base
}

/** @returns {string} */
export function dirname(p) {
    if (typeof p !== "string") return "."
    const idx = p.lastIndexOf("/")
    if (idx === -1) return "."
    if (idx === 0) return "/"
    return p.slice(0, idx)
}

/** @returns {string} */
export function join(...parts) {
    return parts
        .filter((part) => typeof part === "string" && part.length > 0)
        .join("/")
        .replace(/\/+/g, "/")
}

/** @returns {string} */
export function resolve(...parts) {
    return join(...parts)
}

export const sep = "/"

export default { basename, dirname, join, resolve, sep }
