/**
 * @file Application entry point. Boots a {@link Protostar} instance against
 * the bundled `commands.json`, mounts it into `#terminal`, and exposes a
 * dev-only handle on `window.__protostar` for the Playwright suite.
 *
 * The library is consumed via the `@dgtlntv/protostar` workspace package;
 * its entry (`library.ts`) installs the pi-tui process polyfill as a
 * side-effect on first import, so this file does not need to install it
 * itself.
 */

import "@xterm/xterm/css/xterm.css"
import "@dgtlntv/protostar/styles.css"
import { Protostar, type Commands } from "@dgtlntv/protostar"
import commandsData from "./commands.json"

document.addEventListener("DOMContentLoaded", () => {
    const host = document.getElementById("terminal")
    if (!host) throw new Error("Missing #terminal mount point")

    const protostar = new Protostar(host, commandsData as Commands)
    protostar.start()

    if (import.meta.env.DEV) {
        ;(window as unknown as { __protostar: unknown }).__protostar = {
            term: protostar.term,
            tui: protostar.tui,
            shell: protostar.shell,
            history: protostar.history,
            variables: protostar.variables,
        }
    }
})
