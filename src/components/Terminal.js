import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import { setupKeyboardHandler } from "./KeyboardHandler.js"
import { loadCommands } from "../commands/customCommands.js"
import { writeColoredText } from "../utils/writeToTerminal/writeColoredText.js"
import writeCommandLine from "../utils/writeToTerminal/writeCommandLine.js"

let term
let welcomeMessage = "Welcome to the CLI Prototype!\nType 'help' to see a list of available commands."
let welcomeColor = "white"

export function initializeTerminal() {
    loadCommands()
    setupTerminal()
    writeColoredText(term, welcomeMessage, welcomeColor)
    term.write("\r\n")
    writeCommandLine(term)
}

function setupTerminal() {
    term = new Terminal({
        cursorBlink: true,
        fontSize: 18,
        fontFamily: '"Ubuntu Mono", monospace',
        fontWeight: 400,
        theme: {
            background: "#330F25",
            foreground: "#ffffff",
            cursor: "#ffffff",
            selection: "rgba(255, 255, 255, 0.3)",
            black: "#2e3436",
            red: "#cc0000",
            green: "#00975F",
            yellow: "#c4a000",
            blue: "#00407C",
            magenta: "#75507b",
            cyan: "#06989a",
            white: "#d3d7cf",
        },
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(document.getElementById("terminal"))

    fitAddon.fit()
    window.addEventListener("resize", () => fitAddon.fit())

    setupKeyboardHandler(term)
}

export { term }
