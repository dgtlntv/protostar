import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import { setupKeyboardHandler } from "./KeyboardHandler.js"
import { loadCommands } from "../commands/customCommands.js"
import { writeColoredText } from "../utils/writeToTerminal/writeColoredText.js"
import writeCommandLine from "../utils/writeToTerminal/writeCommandLine.js"

let term
let welcomeMessage = "Welcome to the CLI Prototype!\nType 'help' to see a list of available commands."

export function initializeTerminal() {
    const customWelcomeMessage = loadCommands()
    setupTerminal()
    writeColoredText(term, customWelcomeMessage ? customWelcomeMessage.message : welcomeMessage, "white")
    term.write("\r\n")
    writeCommandLine(term)
    term.focus()
}

function setupTerminal() {
    term = new Terminal({
        cursorBlink: true,
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
    term.loadAddon(fitAddon)
    term.open(document.getElementById("terminal"))

    fitAddon.fit()
    window.addEventListener("resize", () => fitAddon.fit())

    setupKeyboardHandler(term)
}

export { term }
