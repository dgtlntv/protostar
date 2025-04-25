import { FitAddon } from "@xterm/addon-fit"
import { Terminal as XTerminal } from "@xterm/xterm"
import inputHandler from "./io/inputHandler.js"
import { TerminalEmulator } from "./io/terminalEmulator/TerminalEmulator.js"
import initializeYargs from "./io/yargs/initializeYargs.js"
import monkeyPatchStdout from "./shims/monkeyPatchStdout.js"

// GENERAL TODO
// 1. Write tests

export class Terminal {
    constructor(element, commands = {}) {
        this.term = new XTerminal({
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

        this.fitAddon = new FitAddon()
        this.terminalEmulator = new TerminalEmulator()

        this.term.loadAddon(this.fitAddon)
        this.term.loadAddon(this.terminalEmulator)

        this.init(element, commands)
    }

    init(element, commands) {
        this.term.open(element)

        if (commands.welcome) {
            this.term.write(commands.welcome + "\n\n")
        }

        this.fitAddon.fit()
        this.resizeHandler = () => this.fitAddon.fit()
        window.addEventListener("resize", this.resizeHandler)

        monkeyPatchStdout()

        const yargs = initializeYargs(this.terminalEmulator, commands)
        inputHandler(this.terminalEmulator, this.term, yargs)
        this.term.focus()
    }

    destroy() {
        window.removeEventListener("resize", this.resizeHandler)
        this.term.dispose()
    }
}
