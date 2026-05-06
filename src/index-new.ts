/**
 * @file Temporary entry point for the new pi-tui-based stack. Loaded by
 * `index-new.html` so the new shell can be hand-validated and smoke-tested
 * alongside the legacy `index.html` entry. Both files are deleted in 2.G
 * once the cutover lands.
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
