/**
 * @file Application entry point. Boots a {@link Protostar} instance against
 * the bundled `commands.json`, mounts it into `#terminal`, and exposes a
 * dev-only handle on `window.__protostar` for the Playwright suite.
 *
 * The library entry re-exports the {@link Protostar} class and `Commands`
 * types from `./library.ts`.
 */

import "@xterm/xterm/css/xterm.css"
import { Protostar } from "./Protostar.js"
import commandsData from "./commands.json"
import type { Commands } from "./types/commands.js"
import "./styles.css"

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
