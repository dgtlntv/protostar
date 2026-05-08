# Protostar Architecture

Protostar is a browser-based CLI prototyping library. It renders an xterm.js terminal and lets authors declaratively define commands (via yargs) whose handlers run a sequence of components — text, spinner, progress bar, table, interactive prompts. Everything runs client-side; the app is a static bundle.

## Workspace Layout

The repo is a pnpm workspace with three packages:

| Package | Path | Role |
|---|---|---|
| `@dgtlntv/protostar` | `packages/protostar/` | Published library — the `Protostar` class, shell, components, types. |
| `@dgtlntv/protostar-codec` | `packages/protostar-codec/` | Published encoder/decoder for URL-shareable `Commands` payloads. Owns the JSON Schema + AJV validator + the `protostar-encode` Node CLI. |
| `@dgtlntv/playground` | `packages/playground/` | Private app — boots the library against `commands.json` for development and the GitHub Pages demo. |

Root `package.json` is a thin orchestration façade: `pnpm dev` / `pnpm build` / `pnpm test:e2e` filter into the playground, `pnpm build:lib` and `pnpm build:codec` filter into the published packages, `pnpm test:unit` and `pnpm typecheck` recurse across the workspace.

## Entry Points

- `packages/playground/index.html` → `packages/playground/src/main.ts` — resolves the boot config (decodes `location.hash` via `@dgtlntv/protostar-codec` if a `#p1=…` fragment is present, falls back to the bundled `commands.json` otherwise — a malformed/schema-invalid hash is reported by prepending a one-line decode error to the bundled welcome banner), instantiates `Protostar` against `#terminal`, installs the Ctrl+Shift+L share-link shortcut via `term.attachCustomKeyEventHandler`, and exposes a dev-only `window.__protostar` handle (terminal handles + the codec primitives) for the e2e suite.
- `packages/protostar/src/library.ts` — re-export surface for `vite build --mode lib` (npm package build, invoked via `pnpm build:lib`); re-exports `Protostar` and the `Commands` types.
- `packages/protostar/vite.config.ts` — library build. Bundles every runtime dep into `dist/index.es.js` / `dist/index.umd.js` (`rollupOptions.external = []`) so downstream consumers can `npm install @dgtlntv/protostar` without writing any shim configuration of their own. Aliases the `node:*` / `child_process` / `fs` / `os` / `path` / `events` modules pi-tui's autocomplete provider eagerly imports to no-op shims under `src/shims/`; those aliases also catch the bundled deps' transitive imports. Aliases the unpkg `cliui` / `yargs-parser` URLs to local packages so `yargs/browser` doesn't fetch from the CDN at runtime.
- `packages/playground/vite.config.ts` — playground dev/app build; consumes the library via the `@dgtlntv/protostar` workspace symlink. Re-applies the same shim aliases the lib build uses, because Vite resolves the workspace symlink to the lib's `src/library.ts` (not its prebuilt `dist/`) for fast dev iteration. The asymmetry is intentional: dev/HMR resolves to source, downstream npm consumers resolve to the prebuilt bundle (where the shims are already baked in) — whoever bundles the source is on the hook for the shims.

## File Layout (`packages/protostar/src/`)

| File | Purpose |
|---|---|
| `Protostar.ts` | Top-level wiring: xterm.js `Terminal` + `FitAddon` + `XtermTerminalAdapter` + pi-tui `TUI` + `VariableStore` + `HistoryStore` + yargs + `ShellLoop`. Owns `start()` / `destroy()` and a `print(message)` helper that drops a static line above the live region (used by the playground for URL-loader notices and share-link confirmations). |
| `library.ts` | Library entry. |
| `tui/XtermTerminal.ts` | Adapter implementing pi-tui's `Terminal` interface against an xterm.js `Terminal`. |
| `tui/theme.ts` | Shared color / style helpers (`flatText`, log-symbol prefixes). |
| `shell/ShellLoop.ts` | Event-driven read → tokenize (`shell-quote`) → dispatch (yargs) → repeat. Reacts to `PromptLine.onComplete` (one or more shell-complete lines from a submit or a multi-line paste) and `onCancel` (Ctrl+C). |
| `shell/PromptLine.ts` | Multi-line shell prompt component. Owns the entire continuation buffer (newlines included) plus a single cursor offset; intercepts Ctrl+C, runs Enter through `isIncomplete` to decide between submit and continuation, and routes both bracketed-paste and raw-bytes paste through a normalize-and-split path that dispatches each shell-complete chunk in order. Up/Down recall via `HistoryStore`. |
| `shell/HistoryStore.ts` | Ring buffer with `push` / `getPrevious` / `getNext` / `rewind`; consecutive-duplicate dedupe. |
| `shell/VariableStore.ts` | Per-instance variable map; declared-key enforcement. |
| `shell/interpolate.ts` | Handlebars wrapper for `{{var}}` substitution against the merged argv + variables context. |
| `shell/evalCondition.ts` | Safelisted expression evaluator (operator + literal + identifier; tokenizer + Pratt parser) used by `conditional` components. |
| `shell/isIncomplete.ts` | Escape-aware shell-syntax continuation detector (unclosed quotes, dangling operators, trailing backslash). |
| `commands/buildYargs.ts` | Builds a yargs command tree from the `Commands` config and binds each handler to a component-list runner. |
| `commands/runComponents.ts` | Component-list dispatcher; switches on `component.component` and invokes the matching component module. |
| `components/text.ts`, `progressBar.ts`, `spinner.ts`, `table.ts`, `variable.ts`, `conditional.ts`, `duration.ts` | Display components built on pi-tui primitives. |
| `components/prompts/InlinePrompt.ts` | One-row inline prompt (message + editable buffer + cursor) used by every text-input prompt. Owns its editing primitives; supports plain / mask / hidden render modes plus an optional keystroke filter. |
| `components/prompts/*` | Interactive prompt components (input, number, password, invisible, list, select, autoComplete, multiSelect, confirm, form, basicAuth, toggle, sort) backed by `InlinePrompt`, pi-tui `SelectList`, and custom focusables. `confirm`, `toggle`, and `form` use bespoke focusables that match the legacy enquirer layouts. |
| `components/context.ts` | Shared component-execution context (`tui`, `variables`, `terminal`). |
| `types/commands.ts` | TypeScript surface mirroring `commands-schema.json`: `Commands`, the `Component` discriminated union, option/positional types. |
| `shims/node*.js` | Minimal stand-ins for the Node-only modules pi-tui's server-side autocomplete eagerly imports (`node:module`, `node:perf_hooks`, `child_process`, `fs`, `os`, `path`). The provider that uses them never instantiates in the browser, so the shims throw on call. |

The playground owns the bundled CLI definition (`packages/playground/src/commands.json`) and the demo coverage config used by the e2e suite (`packages/playground/src/test-commands.json`). The JSON Schema lives at `packages/protostar-codec/schema/commands.schema.json` — the codec is its runtime home, and any consumer (playground, agent skill, CLI) validates `Commands` payloads through `validateCommands` from `@dgtlntv/protostar-codec`.

## Core Flow

1. `Protostar.start()` opens xterm in the host element, runs the FitAddon, registers the Ctrl+C interceptor on `term.onData`, starts the pi-tui `TUI`, optionally writes the welcome banner, then calls `ShellLoop.start()`.
2. `ShellLoop` mounts a `PromptLine` and wires its `onComplete` / `onCancel`. The prompt holds the editable buffer; on Enter it consults `isIncomplete(buffer)` to either insert a literal `\n` (continuation) or emit `onComplete([buffer])`. A multi-line paste fans out to one `onComplete([line1, line2, …])` call, with any post-last-`\n` tail left in the buffer to seed the next prompt.
3. `ShellLoop` flushes each submitted line plus the prompt prefix to scrollback, pushes each to history, and drains the queue by awaiting `yargs.parse(...)` for each line in turn. The matched handler runs the component list via `runComponents(...)`. After the queue empties, a fresh prompt is mounted (with any paste tail seeded as the initial value).

## Cancellation (Ctrl+C)

`ShellLoop` owns a per-dispatch `AbortController`; `currentSignal` is non-null only while a command is mid-flight. `buildYargs` reads it via the `getSignal` closure and threads it into each handler's `ComponentContext.signal`. Long-running components subscribe (timer-based ones via `sleep(ms, signal)`, prompt helpers via an `abort` event listener); `runComponents` checks `signal.aborted` between iterations and throws `CommandCanceledError` to abandon the rest of the handler list (`buildYargs` swallows the sentinel before it reaches yargs's `.fail`).

Two paths into the abort:

- **Idle** — `\x03` falls through pi-tui's focus chain to `PromptLine`, whose own handler clears the buffer, prints `^C`, and re-mounts.
- **Mid-dispatch** — `Protostar` registers a `term.onData` listener **before** `tui.start()` so it fires ahead of pi-tui's input dispatcher; that order matters because the focused prompt's local cancel path would otherwise resolve the prompt promise first and short-circuit the snapshot path. While `shell.isDispatching`, the listener calls `shell.cancelDispatch()`, which aborts the controller (cascading into every subscribed component), drops any queued paste lines, and writes `^C` to scrollback.

Snapshot rendering on abort lives in `promptUtils.ts` — see the policy table at the top of that file.

## TUI Integration

- pi-tui owns the live region at the bottom of the terminal; components added to the `TUI`'s child list are differential-rendered there. Older content is scrolled into history naturally as new content is added.
- `XtermTerminalAdapter` translates pi-tui's `Terminal` operations (write, move, clear, columns/rows) into xterm.js calls.
- The shell prompt is rendered by `PromptLine` directly: the colored prompt prefix on the first row, continuation rows flush at column 0. Cursor placement uses pi-tui's `CURSOR_MARKER` + reverse-video. Per-logical-line horizontal scrolling follows the cursor when a line exceeds the viewport width.

## Notable Dependencies

- `@xterm/xterm`, `@xterm/addon-fit` — terminal.
- `@earendil-works/pi-tui` — TUI rendering primitives, `Input`, `SelectList`, `Loader`.
- `yargs`, `yargs-parser`, `cliui`, `shell-quote` — command parsing. `cliui` is bundled locally because `yargs/browser` imports it from an unpkg URL we alias.
- `chalk`, `cli-spinners`, `command-line-usage`, `string-width`, `strip-ansi`, `ansi-escapes`, `ansi-regex` — styling and width-aware rendering.
- `handlebars` — variable interpolation in components.
- `eventemitter3` — used by transitive deps.

## Testing State

- **Unit suite** (Vitest, `packages/protostar/tests/unit/`) covers each shell primitive (`HistoryStore`, `VariableStore`, `interpolate`, `evalCondition`, `isIncomplete`), the xterm adapter, every display component, and at least one happy-path test per prompt component. Helpers under `tests/unit/helpers/virtualTerm.ts` mount components against `@xterm/headless` + a real `TUI`. Run via `pnpm -r test:unit`.
- **End-to-end suite** (Playwright, `packages/playground/tests/e2e/`) covers the terminal editing surface: input, history, Ctrl+C, multi-line continuation, paste, line wrap, resize, ignored keys, plus per-component happy paths. Tests drive xterm via `window.__protostar` (dev/test builds only) and read state through `shell.currentPrompt.getValue()` / `getCursor()`. Known UX bugs surfaced by the suite are tracked in `.claude/known-bugs.md`; matching tests are `test.fixme`. Run via `pnpm test:e2e`.

CI runs unit + e2e on every PR via `.github/workflows/test.yml`.
