/**
 * @file Side-by-side comparison harness for sub-phase 2.F.5. Mounts the
 * legacy `Terminal` and the new `Protostar` against the same coverage CLI
 * (`test-commands.json`) in a two-pane CSS grid so an operator can drive
 * each pane independently and verdict the output component-by-component.
 *
 * Deleted in 2.G alongside `index-new.html` / `src/index-new.ts`.
 */

import "@xterm/xterm/css/xterm.css"
// @ts-expect-error — legacy JS module without ambient types; deleted in 2.G.
import { Terminal as LegacyTerminal } from "./Terminal.js"
import { Protostar } from "./Protostar.js"
import testCommands from "./test-commands.json"
import type { Commands } from "./types/commands.js"
import "./styles.css"

document.addEventListener("DOMContentLoaded", () => {
    const oldHost = document.getElementById("terminal-old")
    const newHost = document.getElementById("terminal-new")
    if (!oldHost || !newHost) {
        throw new Error(
            "Missing #terminal-old or #terminal-new mount points in index-compare.html",
        )
    }

    const legacy = new LegacyTerminal(oldHost, testCommands)
    const next = new Protostar(newHost, testCommands as Commands)
    next.start()

    if (import.meta.env.DEV) {
        ;(window as unknown as { __protostarCompare: unknown }).__protostarCompare = {
            legacy,
            next,
        }
    }
})
