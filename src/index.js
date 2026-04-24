import "@xterm/xterm/css/xterm.css"
import { Terminal } from "./Terminal"
import commandsData from "./commands.json"
import "./styles.css"

document.addEventListener("DOMContentLoaded", () => {
    const terminal = new Terminal(
        document.getElementById("terminal"),
        commandsData
    )

    if (import.meta.env.DEV) {
        window.__protostar = {
            term: terminal.term,
            localEcho: terminal.localEcho,
        }
    }
})
