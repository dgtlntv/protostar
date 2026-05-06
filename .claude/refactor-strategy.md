# Phase 2 Refactor Strategy

Phase 2 replaces the monolithic input/render stack with a small set of focused modules built on `@mariozechner/pi-tui`, migrates `src/` to TypeScript, and removes the dependency-shim layer (`enquirer`, `ora`, `cli-progress`, `cli-table3`, `log-symbols`, the readline/stdout shims, most node polyfills).

The JSON command/component schema and the `yargs` command tree are preserved. The Phase 1 e2e suite is the safety net.

## Goals

- Dissolve `src/io/LocalEchoController.js` (1064 LOC, 12 fused responsibilities) into narrow modules.
- Adopt pi-tui as the rendering substrate. Delete the hand-rolled cursor math and ANSI write helpers.
- Drop every dependency we currently shim Node APIs around (`enquirer`, `ora`, `cli-progress`, `cli-table3`, `log-symbols`, the `readline` alias, `monkeyPatchStdout`, ideally `vite-plugin-node-polyfills`).
- Migrate `src/` to TypeScript (test tree was migrated in Phase 1).
- Resolve all 7 known UX bugs (BUG-001 through BUG-007) by construction.

## Non-goals

- No backwards compatibility on internals — old files are deleted, not migrated.
- No new component types and no schema additions. Phase 2 reproduces today's output through a cleaner stack.
- No public-API churn beyond what TS migration requires. `new Protostar(element, commands)` stays.
- No refactor of yargs integration beyond the mechanical port — yargs is kept and the read→parse→handler loop stays the same shape.

## Schema changes

Drop these prompt types from `src/commands-schema.json` (and from the `Commands` TS type):

- `survey` — matrix prompt, rarely used.
- `scale` — matrix prompt with numeric scale.
- `quiz` — `select` plus a correct-answer key.

20 of the 23 component types remain. Authors using these three need to migrate before consuming the new build.

## Target module layout

```
src/
├── index.ts                  # Public re-exports
├── Protostar.ts              # Wires xterm + pi-tui Terminal + Shell
├── tui/
│   ├── XtermTerminal.ts      # pi-tui Terminal interface backed by xterm.js
│   └── theme.ts              # chalk wrappers + log-symbol glyphs
├── shell/
│   ├── ShellLoop.ts          # read → tokenize → yargs.parse → handler → repeat
│   ├── PromptLine.ts         # Prompt + idle pi-tui `Input`
│   ├── HistoryStore.ts       # Ring buffer (uses shift())
│   ├── VariableStore.ts      # Replaces module-level globalVariables
│   ├── interpolate.ts        # Handlebars wrapper
│   ├── evalCondition.ts      # Safelisted expression evaluator
│   └── isIncomplete.ts       # Escape-aware continuation detection
├── commands/
│   ├── buildYargs.ts         # JSON tree → yargs commands
│   └── runComponents.ts      # Component-list dispatcher
├── components/
│   ├── text.ts
│   ├── progressBar.ts        # Custom pi-tui Component
│   ├── spinner.ts            # Wraps pi-tui Loader
│   ├── table.ts              # Custom pi-tui Component
│   ├── variable.ts
│   ├── conditional.ts
│   └── prompts/
│       ├── input.ts          # input, number, password, invisible
│       ├── select.ts         # select, autoComplete
│       ├── multiSelect.ts
│       ├── confirm.ts
│       ├── list.ts
│       ├── form.ts
│       ├── basicAuth.ts
│       ├── toggle.ts
│       ├── sort.ts
│       └── snippet.ts
└── types/
    └── commands.ts           # TS types mirroring commands-schema.json
```

## Pinned decisions

- **`conditional.if`** — replaced by a safelisted expression evaluator supporting `===`, `!==`, `==`, `!=`, `&&`, `||`, `!`, parentheses, and identifier lookup against `{ ...argv, ...variables }`. No `new Function(...)`, no arbitrary JS in the page.
- **Variable scope** — one `VariableStore` instance per `Protostar`, owned by the `Shell` and threaded into every handler context. No module-level state.
- **Welcome banner** — written by `Protostar.start()` before the shell loop begins. No user-visible change.
- **`clear`** — implicit command stays. Wired through `tui.terminal.clearScreen()`.
- **Test handle** — `window.__protostar` survives the cutover. Shape becomes `{ term, tui, shell, history, variables }`. The e2e helper that today reads `localEcho._input` / `_cursor` is updated in 2.G to read the equivalent fields on `shell` (concrete names land at implementation time).
- **Public API** — `new Protostar(element, commands)`. Same shape as today, but `commands` becomes a typed `Commands` interface.

## Dependency churn

### Removed

- `enquirer`, `ora`, `cli-progress`, `cli-table3`, `log-symbols`
- `path` (browser polyfill)
- `cliui` (was a transitive workaround; check whether `yargs/browser` still needs the CDN aliases — keep them if it does)
- `string-argv` — `shell-quote.parse` covers both its tokenization role (for yargs) and the continuation-detection role in `isIncomplete.ts`. Drop in 2.F when `ShellLoop.ts` is wired against `shell-quote` directly. Filter operator tokens (or stop at the first one) before handing the array to `yargs.parse`.
- `vite-plugin-node-polyfills` if pi-tui's `process.nextTick` / `events` / `perf_hooks` needs can be covered by lighter shims; otherwise keep with a narrowed `include`.

### Added

- `@mariozechner/pi-tui`

### Kept

- `@xterm/xterm`, `@xterm/addon-fit`
- `yargs`, `yargs-parser`, `shell-quote`
- `handlebars`, `chalk`

## Bugs resolved by construction

- **BUG-001** (alt+arrow word nav) — pi-tui's `keys.ts` decodes the meta+arrow sequences xterm emits.
- **BUG-002** (ctrl+backspace word delete) — same; pi-tui's `Input` implements word-wise delete.
- **BUG-003** (history drops newest) — `HistoryStore` uses `shift()`.
- **BUG-004** (escaped quotes mis-counted) — `isIncomplete.ts` uses `shell-quote` tokenization.
- **BUG-005** (left-arrow doesn't cross wrap row) — pi-tui's diff renderer only emits absolute cursor positioning. Bare `cursorBackward(1)` doesn't exist in our code anymore.
- **BUG-006** (multi-line paste loses post-first-line chars) — pi-tui supports bracketed paste; `ShellLoop` queues paste across read cycles instead of feeding a synchronous `forEach`.
- **BUG-007** (Escape inserts `\x1b`) — pi-tui's `Input` has explicit Escape handling and refuses to insert C0 control bytes.

The matching `test.fixme`s flip to `test` in the cleanup sub-phase. If any bug survives, it stays fixme'd and gets a new known-bugs entry explaining the gap.

## Custom pi-tui components we own

pi-tui doesn't ship these; ~50–150 LOC each.

- **`ProgressBar`** — current/total + label. pi-tui's `Loader` is animation-only.
- **`Table`** — column-width fitting, optional `colWidths`, word wrap. pi-tui has a private markdown table renderer but it's not exported.
- **`LogSymbol`** — helper that prepends `✔` / `✖` / `ℹ` / `⚠` to a `Text` line. Replaces `log-symbols`.

Spinner reuses pi-tui's `Loader`. Confirm/sort/toggle/snippet are thin wrappers over `Input`/`SelectList`.

## Out-of-scope for Phase 2

- Component/yargs-layer Phase 2 *test plan* (the original Phase 1 doc reserved this slot for tests). With the refactor in flight that test work is deferred — write it after Phase 2 lands, against the new module surface.
- Autocomplete in the shell. The existing implementation in `LocalEchoController` is dead code (never wired up by `inputHandler`); it goes away with the rest of the file. Resurrecting it is a future feature, not part of this refactor.
- Bundle-size measurement / performance baselining. Sanity-check informally; no formal budget.
