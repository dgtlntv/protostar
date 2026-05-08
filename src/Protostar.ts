/**
 * @file Public Protostar class. Wires xterm.js, the pi-tui adapter, the
 * pi-tui `TUI`, the `ShellLoop`, and the yargs command tree built from a
 * `Commands` config.
 */

import { FitAddon } from "@xterm/addon-fit"
import { Terminal as XTerminal } from "@xterm/xterm"
import {
    KeybindingsManager,
    setKeybindings,
    TUI,
    TUI_KEYBINDINGS,
    type KeybindingsConfig,
} from "@earendil-works/pi-tui"
import chalk from "chalk"

import type { Commands } from "./types/commands.js"
import { XtermTerminalAdapter } from "./tui/XtermTerminal.js"
import { flatText } from "./tui/theme.js"
import { HistoryStore } from "./shell/HistoryStore.js"
import { VariableStore } from "./shell/VariableStore.js"
import { ShellLoop } from "./shell/ShellLoop.js"
import type { PromptLine } from "./shell/PromptLine.js"
import { buildYargs } from "./commands/buildYargs.js"
import { runComponents } from "./commands/runComponents.js"

/** Default colored shell prompt: `user@ubuntu:~$ `. */
const DEFAULT_PROMPT =
    chalk.green("user@ubuntu") + ":" + chalk.blue("~") + "$ "

/**
 * Browser xterm.js emits the raw byte `\x08` for Ctrl+Backspace and the
 * raw byte `\x7f` for plain Backspace. pi-tui's default `ctrl+backspace`
 * matcher only recognises Kitty / modifyOtherKeys sequences, so the raw
 * `\x08` falls through to plain Backspace. Adding `ctrl+h` (which pi-tui
 * canonicalises to `\x08`) to the word-delete keybinding restores the
 * expected behaviour. Plain Backspace continues to fire on `\x7f`.
 *
 * `PromptLine` deliberately checks `deleteWordBackward` before
 * `deleteCharBackward` so the shared-byte case routes to word delete.
 */
const KEYBINDING_OVERRIDES: KeybindingsConfig = {
    "tui.editor.deleteWordBackward": [
        "ctrl+w",
        "alt+backspace",
        "ctrl+backspace",
        "ctrl+h",
    ],
}

setKeybindings(new KeybindingsManager(TUI_KEYBINDINGS, KEYBINDING_OVERRIDES))

/**
 * Top-level wiring class. Construct with the host element and the parsed
 * `commands.json`; `start()` opens xterm in the host element, prints the
 * welcome banner, and begins the read-eval loop.
 *
 * The class exposes `tui`, `shell`, `history`, and `variables` for the
 * dev-only `window.__protostar` test handle (set up in `index.ts`).
 */
export class Protostar {
    /** Underlying xterm.js Terminal. */
    readonly term: XTerminal
    /** Adapter implementing pi-tui's Terminal interface against `term`. */
    readonly terminal: XtermTerminalAdapter
    /** pi-tui rendering surface. */
    readonly tui: TUI
    /** Per-instance variable store. */
    readonly variables: VariableStore
    /** Per-instance command history. */
    readonly history: HistoryStore
    /** Read-eval loop. */
    readonly shell: ShellLoop

    private readonly fitAddon = new FitAddon()
    private readonly element: HTMLElement
    private readonly commands: Commands
    private resizeHandler?: () => void
    private interruptDisposable?: { dispose(): void }

    /**
     * @param element Host DOM element; xterm.js attaches its viewport here.
     * @param commands Parsed `commands.json`.
     */
    constructor(element: HTMLElement, commands: Commands) {
        this.element = element
        this.commands = commands

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
                selectionBackground: "rgba(255, 255, 255, 0.3)",
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

        this.terminal = new XtermTerminalAdapter(this.term)
        this.tui = new TUI(this.terminal, true)
        this.variables = new VariableStore(commands.variables ?? {})
        this.history = new HistoryStore()

        const yargs = buildYargs(commands, {
            tui: this.tui,
            variables: this.variables,
            run: runComponents,
            terminal: this.terminal,
            // Resolved at handler-invocation time so the closure works
            // despite `this.shell` being assigned only after this call.
            getSignal: () => this.shell?.currentSignal,
        })

        this.shell = new ShellLoop({
            tui: this.tui,
            yargs,
            history: this.history,
            prompt: DEFAULT_PROMPT,
        })
    }

    /**
     * Open the terminal in the host element, print the welcome banner, and
     * start the read-eval loop.
     */
    start(): void {
        this.term.open(this.element)
        this.term.loadAddon(this.fitAddon)
        this.fitAddon.fit()
        this.resizeHandler = () => this.fitAddon.fit()
        window.addEventListener("resize", this.resizeHandler)

        // Catch Ctrl+C alongside whatever pi-tui delivers to the focused
        // child. While a command is dispatching, the byte routes to
        // `shell.cancelDispatch()` so non-focused components (spinner,
        // progressBar, timed text) get cancelled too — pi-tui's focus
        // chain only reaches whichever child has focus, which is `null`
        // for those components. While idle, the byte falls through to
        // PromptLine's own `\x03` handler unchanged.
        //
        // Registered BEFORE `tui.start()` so xterm fires this listener
        // before the TUI's own input dispatcher: that way `cancelDispatch`
        // runs the snapshot/abort path before any focused component's
        // local `\x03` handler can short-circuit the same prompt promise.
        this.interruptDisposable = this.term.onData((data) => {
            if (data === "\x03" && this.shell.isDispatching) {
                this.shell.cancelDispatch()
            }
        })

        this.tui.start()

        if (this.commands.welcome) {
            this.tui.addChild(flatText(this.commands.welcome))
            this.tui.requestRender()
        }

        this.shell.start()
        this.term.focus()
    }

    /** Tear down listeners and dispose the underlying xterm. */
    destroy(): void {
        if (this.resizeHandler) {
            window.removeEventListener("resize", this.resizeHandler)
            this.resizeHandler = undefined
        }
        this.interruptDisposable?.dispose()
        this.interruptDisposable = undefined
        this.tui.stop()
        this.term.dispose()
    }

    /** Convenience accessor for the live shell prompt (test handle). */
    get currentPrompt(): PromptLine | null {
        return this.shell.currentPrompt
    }
}
