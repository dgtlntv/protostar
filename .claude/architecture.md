# Protostar Architecture

Protostar is a browser-based CLI prototyping library. It renders an xterm.js terminal and lets authors declaratively define commands (via yargs) whose handlers run a sequence of "components" (text, spinner, progress bar, table, interactive prompts). Everything runs client-side; the app is a static bundle.

## Entry Points

- `index.html` → `src/index.js` → instantiates `Terminal` on `DOMContentLoaded`.
- `src/library.js` — export surface for `vite build --mode lib` (npm package build).
- `vite.config.js` — default dev/app build; library build when `--mode lib`. Uses `vite-plugin-node-polyfills` (path, process, Buffer, global) and aliases `readline` → `src/shims/readlineShim.js`.

## File Layout (`src/`)

| File | Purpose |
|---|---|
| `Terminal.js` | Wires xterm.js + FitAddon + LocalEchoController, writes banner, starts the input loop. |
| `index.js` | DOM bootstrap. |
| `library.js` | Library entry. |
| `io/inputHandler.js` | Read → parse (yargs) → dispatch → repeat loop. |
| `io/LocalEchoController.js` | Prompt rendering, cursor math, keystroke dispatch, input editing, history integration. Forked/extended `local-echo`. |
| `io/HistoryController.js` | Ring buffer (default size 10), `getPrevious` / `getNext`, dedupes consecutive duplicates. |
| `io/Utils.js` | Cursor math (`offsetToColRow`, `countLines`, word boundaries), `decodeANSIKeypressData`, incomplete-input detection. |
| `io/yargs/initializeYargs.js` | Strict yargs setup, error routing. |
| `io/yargs/commandsToYargs.js` | Recursively builds yargs command tree from user config (aliases, positional, options, subcommands). |
| `io/yargs/componentsToYargsHandler.js` | Executes component lists: text, spinner, progress, table, enquirer prompts, conditionals, variable interpolation. |
| `shims/monkeyPatchStdout.js` | Proxies `process.stdout`/`stderr` to LocalEchoController so Node-style libs (ora, cli-progress, enquirer) render into xterm. |
| `shims/readlineShim.js` | Minimal readline API for enquirer in the browser. |
| `config/commandLineConfig.js` | Styled prompt segments (`COMMAND_LINE_PREFIX`). |
| `utils/sleep.js` | Async sleep (fixed ms or `"random"` 100–3000ms). |

## Core Flow

1. `Terminal.init()` opens xterm in the DOM, prints the welcome banner, attaches `FitAddon`, then calls `inputHandler(localEcho, term, yargs)`.
2. `inputHandler` awaits `localEcho.read(prompt)`, parses the resulting string with `string-argv` + yargs, runs the matched handler (which expands components via `componentsToYargsHandler`), then recurses.
3. `LocalEchoController` captures keystrokes via `term.onData(...)` registered in `attach()` / `activate()`. Data flows `handleTermData` → `decodeTermData` → `decodeANSIKeypressData` → `handleActiveInput`.

## xterm.js Integration

- Addons: `FitAddon`, `LocalEchoController` (itself loaded as an xterm addon).
- **The prompt is never part of `_input`.** It's stored on `_activePrompt.prompt` and re-applied by `applyPrompts()` on render. Cursor offsets are always relative to `_input`, so the prompt is unreachable by editing.
- **Cursor bounds** (`handleCursorMove`): left clamped `> 0`, right clamped `< _input.length`. `Home` / `End` set cursor to `0` / `_input.length`.
- **Backspace / delete** (`handleCursorErase`): early-returns at input start / end so prompt chars are never eaten.
- **Render optimizations:**
  - Typing at end of input → direct `term.write(data)` (no redraw).
  - Backspace at end → `\b \b`.
  - Anywhere else → full `setInput()` redraw with recomputed cursor.
  - History navigation uses `setHistoryInputWithHiddenCursor()` — hides cursor during redraw to eliminate flicker.

## Multi-line / Continuation

`applyPrompts()` joins input with `\n` + continuation prompt. Enter inserts a literal `\n` when shell syntax is incomplete (unclosed quote, trailing backslash, dangling `&&` / `||` / `|`) — detection lives in `Utils.js`. Otherwise Enter completes the read.

## Paste Handling

`handleTermData` detects paste (`data.length > 3`), normalizes line endings via `/[\r\n]+/g` → `\r`, and feeds characters through `decodeTermData` one by one — so each `\r` in pasted content runs the normal Enter path (submit if complete, continuation if not).

## Notable Dependencies

- `@xterm/xterm`, `@xterm/addon-fit` — terminal.
- `ansi-escapes`, `ansi-regex`, `strip-ansi`, `string-width` — cursor math and width-aware rendering.
- `yargs`, `string-argv`, `shell-quote` — command parsing.
- `enquirer` (needs readline shim), `ora`, `cli-spinners`, `cli-progress`, `cli-table3`, `chalk`, `log-symbols` — component rendering.
- `handlebars` — variable interpolation in components.
- `eventemitter3` — base class for LocalEchoController.

## Testing State

No tests exist. No test runner configured. `Terminal.js` has a top-of-file TODO: "Write tests". See `.claude/testing-strategy.md`.
