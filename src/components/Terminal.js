import { Terminal } from "xterm"
import { FitAddon } from "xterm-addon-fit"
import { setupKeyboardHandler } from "./KeyboardHandler.js"
import { loadCommands } from "../commands/customCommands.js"
import { writeColoredText } from "../utils/textFormatting.js"

let term
let welcomeMessage = "Welcome to the CLI Prototype!\nType 'help' to see a list of available commands."
let welcomeColor = "white"

export async function initializeTerminal() {
    await loadCommands()
    setupTerminal()
    writeColoredText(term, welcomeMessage, welcomeColor)
    writePrompt()
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

export function writePrompt() {
    term.write("\r\n\x1b[1;32muser@ubuntu\x1b[0m:\x1b[1;34m~\x1b[0m\x1b[37m$ \x1b[0m")
}

export { term }
