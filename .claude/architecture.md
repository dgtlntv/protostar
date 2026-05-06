# Protostar Architecture

Protostar is a browser-based CLI prototyping library. It renders an xterm.js terminal and lets authors declaratively define commands (via yargs) whose handlers run a sequence of components — text, spinner, progress bar, table, interactive prompts. Everything runs client-side; the app is a static bundle.

## Entry Points

- `index.html` → `src/index.ts` — instantiates `Protostar` against `#terminal` on `DOMContentLoaded` and exposes a dev-only `window.__protostar` handle for the e2e suite.
- `src/library.ts` — re-export surface for `vite build --mode lib` (npm package build); re-exports `Protostar` and the `Commands` types from `./index.ts`.
- `vite.config.js` — default dev/app build; library build when `--mode lib`. Aliases the `node:*` / `child_process` / `fs` / `os` / `path` modules pi-tui's autocomplete provider eagerly imports to no-op shims under `src/shims/`. Aliases `https://unpkg.com/cliui@7.0.1/index.mjs` and the unpkg `yargs-parser` URL to local packages so `yargs/browser` doesn't fetch from the CDN at runtime. `vite-plugin-node-polyfills` polyfills `process` for yargs.

## File Layout (`src/`)

| File | Purpose |
|---|---|
| `Protostar.ts` | Top-level wiring: xterm.js `Terminal` + `FitAddon` + `XtermTerminalAdapter` + pi-tui `TUI` + `VariableStore` + `HistoryStore` + yargs + `ShellLoop`. Owns `start()` / `destroy()`. |
| `index.ts` | DOM bootstrap; instantiates `Protostar`, prints the welcome banner via the `Commands` config, exposes the dev handle. |
| `library.ts` | Library entry. |
| `tui/XtermTerminal.ts` | Adapter implementing pi-tui's `Terminal` interface against an xterm.js `Terminal`. |
| `tui/theme.ts` | Shared color / style helpers (`flatText`, log-symbol prefixes). |
| `shell/ShellLoop.ts` | Read → tokenize (`shell-quote`) → dispatch (yargs) → repeat. Manages the live `PromptLine` and the multi-line continuation buffer. |
| `shell/PromptLine.ts` | Idle-state prompt component: renders the prompt prefix on the same row as a pi-tui `Input`, wires Up/Down to `HistoryStore`. |
| `shell/HistoryStore.ts` | Ring buffer with `push` / `getPrevious` / `getNext` / `rewind`; consecutive-duplicate dedupe. |
| `shell/VariableStore.ts` | Per-instance variable map; declared-key enforcement. |
| `shell/interpolate.ts` | Handlebars wrapper for `{{var}}` substitution against the merged argv + variables context. |
| `shell/evalCondition.ts` | Safelisted expression evaluator (operator + literal + identifier; tokenizer + Pratt parser) used by `conditional` components. |
| `shell/isIncomplete.ts` | Escape-aware shell-syntax continuation detector (unclosed quotes, dangling operators, trailing backslash). |
| `commands/buildYargs.ts` | Builds a yargs command tree from the `Commands` config and binds each handler to a component-list runner. |
| `commands/runComponents.ts` | Component-list dispatcher; switches on `component.component` and invokes the matching component module. |
| `components/text.ts`, `progressBar.ts`, `spinner.ts`, `table.ts`, `variable.ts`, `conditional.ts`, `duration.ts` | Display components built on pi-tui primitives. |
| `components/prompts/*` | Interactive prompt components (input, number, password, invisible, list, select, autoComplete, multiSelect, confirm, form, basicAuth, toggle, sort, snippet) backed by pi-tui `Input` / `SelectList` / custom focusables. |
| `components/context.ts` | Shared component-execution context (`tui`, `variables`, `terminal`). |
| `types/commands.ts` | TypeScript surface mirroring `commands-schema.json`: `Commands`, the `Component` discriminated union, option/positional types. |
| `commands.json` / `commands-schema.json` | Default CLI definition + JSON Schema; `commands.json` is bundled at build time. |
| `shims/node*.js` | Minimal stand-ins for the Node-only modules pi-tui's server-side autocomplete eagerly imports (`node:module`, `node:perf_hooks`, `child_process`, `fs`, `os`, `path`). The provider that uses them never instantiates in the browser, so the shims throw on call. |

## Core Flow

1. `Protostar.start()` opens xterm in the host element, runs the FitAddon, starts the pi-tui `TUI`, optionally writes the welcome banner, then calls `ShellLoop.start()`.
2. `ShellLoop` mounts a `PromptLine` and awaits a complete command. If `isIncomplete(buffer)` returns true on Enter, the partial line is buffered and a fresh prompt is mounted to read the next continuation line; otherwise the assembled multi-line input is parsed with `shell-quote` and handed to yargs as `string[]`.
3. The matched yargs handler invokes `runComponents(...)`, which walks the component list, mounting each component onto the shared `TUI`. When the handler resolves, `ShellLoop` re-mounts the prompt.

## TUI Integration

- pi-tui owns the live region at the bottom of the terminal; components added to the `TUI`'s child list are differential-rendered there. Older content is scrolled into history naturally as new content is added.
- `XtermTerminalAdapter` translates pi-tui's `Terminal` operations (write, move, clear, columns/rows) into xterm.js calls.
- The shell prompt is rendered by `PromptLine` as `<colored prompt prefix><pi-tui Input>` on a single row, so editing always operates on the editable buffer — the prompt prefix is unreachable.

## Notable Dependencies

- `@xterm/xterm`, `@xterm/addon-fit` — terminal.
- `@mariozechner/pi-tui` — TUI rendering primitives, `Input`, `SelectList`, `Loader`.
- `yargs`, `yargs-parser`, `cliui`, `shell-quote` — command parsing. `cliui` is bundled locally because `yargs/browser` imports it from an unpkg URL we alias.
- `chalk`, `cli-spinners`, `command-line-usage`, `string-width`, `strip-ansi`, `ansi-escapes`, `ansi-regex` — styling and width-aware rendering.
- `handlebars` — variable interpolation in components.
- `eventemitter3` — used by transitive deps.

## Testing State

- **Unit suite** (Vitest, `tests/unit/`) covers each shell primitive (`HistoryStore`, `VariableStore`, `interpolate`, `evalCondition`, `isIncomplete`), the xterm adapter, every display component, and at least one happy-path test per prompt component. Helpers under `tests/unit/helpers/virtualTerm.ts` mount components against `@xterm/headless` + a real `TUI`.
- **End-to-end suite** (Playwright, `tests/e2e/`) covers the terminal editing surface: input, history, Ctrl+C, multi-line continuation, paste, line wrap, resize, ignored keys, plus per-component happy paths. Tests drive xterm via `window.__protostar` (dev/test builds only) and read state through `shell.currentPrompt.getValue()` / `getCursor()`. Known UX bugs surfaced by the suite are tracked in `.claude/known-bugs.md`; matching tests are `test.fixme`.

CI runs unit + e2e on every PR via `.github/workflows/test.yml`.
