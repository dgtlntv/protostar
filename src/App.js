import { Terminal } from "xterm"
import { FitAddon } from "@xterm/addon-fit"
import LocalEchoController from "./io/LocalEchoController.js"
import inputHandler from "./io/inputHandler.js"

export default function App() {
    const term = new Terminal({
        cursorBlink: true,
        convertEol: true,
        fontSize: 16,
        fontFamily: '"Ubuntu Mono", monospace',
        fontWeight: "100",
        fontWeightBold: "bold",
        theme: {
            background: "#330F25",
            foreground: "#ffffff",
            cursor: "#ffffff",
            selection: "rgba(255, 255, 255, 0.3)",
            black: "#2e3436",
            red: "#cc0000",
            green: "#00975F",
            yellow: "#c4a000",
            blue: "#00407D",
            magenta: "#75507b",
            cyan: "#06989a",
            white: "#ffffff",
        },
    })

    const fitAddon = new FitAddon()
    const localEcho = new LocalEchoController()

    term.loadAddon(fitAddon)
    term.loadAddon(localEcho)
    term.open(document.getElementById("terminal"))

    fitAddon.fit()
    window.addEventListener("resize", (event) => {
        fitAddon.fit()
    })

    inputHandler(localEcho, term)
    term.focus()
}
