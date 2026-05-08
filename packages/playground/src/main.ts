/**
 * @file Application entry point. Resolves the boot config (decoded URL hash
 * if a `#p1=…` fragment is present, bundled `commands.json` otherwise),
 * boots a {@link Protostar} instance against `#terminal`, installs the
 * Ctrl+Shift+L share-link shortcut, and exposes a dev-only handle on
 * `window.__protostar` for the Playwright suite.
 *
 * On a malformed / schema-invalid hash we still boot the bundled demo so
 * the playground stays usable, but prepend an explanatory error line to
 * the welcome banner. Silent fallback would be the worst UX for a shared
 * link — the recipient needs to know the URL is broken and what to fix.
 */

import "@xterm/xterm/css/xterm.css"
import "@dgtlntv/protostar/styles.css"
import { Protostar, type Commands } from "@dgtlntv/protostar"
import {
    bytesToBase64url,
    compressDeflateRaw,
    decode,
    encode,
} from "@dgtlntv/protostar-codec"
import bundledCommands from "./commands.json"

document.addEventListener("DOMContentLoaded", () => {
    void boot()
})

/**
 * Resolve the boot config, instantiate Protostar, install the share
 * shortcut, and (in dev) wire the e2e handle. Async because URL decoding
 * is async (deflate-raw runs through the browser's CompressionStream).
 */
async function boot(): Promise<void> {
    const host = document.getElementById("terminal")
    if (!host) throw new Error("Missing #terminal mount point")

    const bundled = bundledCommands as Commands
    const commands = await resolveBootCommands(bundled)

    const protostar = new Protostar(host, commands)
    protostar.start()

    installShareShortcut(protostar, commands)

    if (import.meta.env.DEV) {
        ;(window as unknown as { __protostar: unknown }).__protostar = {
            term: protostar.term,
            tui: protostar.tui,
            shell: protostar.shell,
            history: protostar.history,
            variables: protostar.variables,
            // Codec primitives exposed for the URL-loader e2e suite. The
            // playground already bundles the codec; re-exporting it on
            // the dev handle saves the test suite from spawning a Node-
            // side encoder pass before each navigation. Stripped from
            // production builds via the `import.meta.env.DEV` guard.
            codec: {
                encode,
                decode,
                compressDeflateRaw,
                bytesToBase64url,
            },
        }
    }
}

/**
 * Decide which `Commands` value to boot with based on `location.hash`.
 *
 * - No hash (or `#` alone): return the bundled demo unchanged.
 * - Valid `#p1=…`: return the decoded commands; the URL author is in
 *   charge of the welcome banner.
 * - Malformed / schema-invalid hash: return the bundled demo with the
 *   decode error prepended to the welcome banner so the recipient sees
 *   what went wrong and falls back to a working playground.
 */
async function resolveBootCommands(bundled: Commands): Promise<Commands> {
    const hash = window.location.hash
    if (!hash || hash === "#") return bundled

    const result = await decode(hash)
    if (result.ok) return result.commands

    const errorLine = `Could not load shared prototype: ${result.error}. Falling back to the bundled demo — fix the URL and reload to retry.`
    const welcome = bundled.welcome
        ? `${errorLine}\n${bundled.welcome}`
        : errorLine
    return { ...bundled, welcome }
}

/**
 * Wire Ctrl+Shift+L to encode the live commands and copy a share URL to
 * the clipboard. We hook through `term.attachCustomKeyEventHandler` so
 * xterm can intercept the chord before its default paste/clipboard path
 * (`Ctrl+Shift+V`) engages — returning `false` tells xterm not to forward
 * the keystroke into the terminal stream.
 *
 * The shortcut is always available, but the documented use case is
 * sharing a bundled-demo session: a URL-loaded prototype already has a
 * working share URL (its own).
 */
function installShareShortcut(
    protostar: Protostar,
    commands: Commands
): void {
    protostar.term.attachCustomKeyEventHandler((event) => {
        if (event.type !== "keydown") return true
        if (!event.ctrlKey || !event.shiftKey) return true
        if (event.code !== "KeyL") return true
        event.preventDefault()
        void copyShareLink(protostar, commands)
        return false
    })
}

/**
 * Encode `commands` and write the resulting `${origin}${pathname}#p1=…`
 * URL to the clipboard, surfacing a one-line confirmation (or error
 * reason) in the terminal area. Errors come from two places: schema
 * rejection inside `encode` (reachable if the bundled demo ever drifts
 * out of schema) and `navigator.clipboard.writeText` rejection (insecure
 * context, permission denied).
 */
async function copyShareLink(
    protostar: Protostar,
    commands: Commands
): Promise<void> {
    try {
        const payload = await encode(commands)
        const url = `${window.location.origin}${window.location.pathname}#${payload}`
        await navigator.clipboard.writeText(url)
        protostar.print("Share link copied to clipboard.")
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        protostar.print(`Could not copy share link: ${message}`)
    }
}
