# Phase 2 Implementation Plan — Refactor

Turns `.claude/refactor-strategy.md` into an ordered set of sub-phases. Continues on the existing `testing-strategy` branch (no new branch). Each sub-phase ends in a single commit on a green tree.

## Cross-cutting rules

- One commit per sub-phase. Same message style as Phase 1: short imperative title, blank line, 2–4 bullets summarizing what changed and why. Co-author Claude as before.
- The Phase 1 e2e suite is the cutover gate — sub-phases 2.A–2.F add new code without wiring it into the running app, so the suite keeps passing automatically. 2.G is the only commit where the suite has to keep passing under freshly cut-over code; that is where the design either holds or doesn't.
- New files are TypeScript. Old `.js` files keep working until they're deleted in 2.G.
- Test responsibilities (e2e cutover gate, Vitest unit tests per module, the pre-cutover smoke) are spelled out in `.claude/testing-strategy-phase-2.md`. Each sub-phase below references the relevant section there for its exit criteria; this file only restates what's distinctive.
- BUG fixmes are touched only in 2.H. If a bug survives the refactor it stays fixme'd and gets a new known-bugs entry explaining why.

## Sub-phase 2.A — TS scaffolding + Commands type

- Add `tsconfig.json` at repo root scoped to `src/`. `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `noEmit: true` (Vite handles emit). Keep `tests/tsconfig.json` as-is.
- Add `src/types/commands.ts` mirroring `src/commands-schema.json`. Export `Commands`, every component variant interface, and a `Component` discriminated union keyed on `component`.
- Verify Vite resolves `.ts` files in `src/` (it should — already works for the test tree).

**Exit criteria:** `npm run dev` and `npm run build` both succeed with the TS files present (none imported yet). Existing e2e green.
**Commit:** `chore: add TS config and Commands type`

## Sub-phase 2.B — pi-tui adapter

- Add `@mariozechner/pi-tui` to `dependencies`. Add `vitest`, `@vitest/ui` to `devDependencies`.
- Implement `src/tui/XtermTerminal.ts` — class implementing pi-tui's `Terminal` interface against an xterm `Terminal` instance. Pattern after `pi-mono/packages/tui/test/virtual-terminal.ts`.
- Add `vitest.config.ts`, `tests/unit/`, and `tests/unit/helpers/virtualTerm.ts`. Add `tests/unit/xterm-terminal.spec.ts` covering the assertions in `testing-strategy-phase-2.md §XtermTerminal`.
- Add `npm run test:unit` and `npm run test:unit:ui` scripts. Update the CI workflow to run `test:unit` before `test:e2e`.

**Exit criteria:** new unit spec green; existing e2e green.
**Commit:** `refactor(tui): add pi-tui Terminal adapter for xterm.js`

## Sub-phase 2.C — Shell primitives

- `src/shell/HistoryStore.ts` — fixes BUG-003 (uses `shift()`, not `pop(0)`).
- `src/shell/VariableStore.ts` — get/set/has, reject undeclared keys with an explicit return rather than `console.error`.
- `src/shell/interpolate.ts` — handlebars wrapper.
- `src/shell/evalCondition.ts` — safelisted expression evaluator (operators: `===`, `!==`, `==`, `!=`, `&&`, `||`, `!`, parens, identifier lookup, string and number literals). Tokenizer + Pratt parser, ~100 LOC.
- `src/shell/isIncomplete.ts` — escape-aware continuation detection using `shell-quote.parse`. Fixes BUG-004.
- Unit specs per `testing-strategy-phase-2.md §HistoryStore`, `§VariableStore`, `§interpolate`, `§evalCondition`, `§isIncomplete`.

**Exit criteria:** the listed unit-test sections pass; existing e2e green.
**Commit:** `refactor(shell): add history, variable, interpolation, condition primitives`

## Sub-phase 2.D — Display components

Implement, with unit tests:

- `src/components/text.ts` — wraps pi-tui `Text`, supports `output` + optional log-symbol prefix via `theme.ts`.
- `src/components/progressBar.ts` — custom pi-tui `Component`. Reproduces the current jittered timing model (60% normal step, 40% burst, 0–80ms gap).
- `src/components/spinner.ts` — wraps pi-tui `Loader`. Supports the array-of-phrases form by swapping the loader's message text on a timer.
- `src/components/table.ts` — custom pi-tui `Component`. Column-width fitting from `process.stdout.columns` is replaced with `terminal.columns`. Honors optional `colWidths`. Word wrap on by default.
- `src/components/variable.ts` — mutates `VariableStore`.
- `src/components/conditional.ts` — calls `evalCondition` and recurses into `then`/`else`.

Each component is a function `(component, ctx) => Promise<void>` that mounts pi-tui Components onto the shared `TUI` and resolves when done.

**Exit criteria:** the unit specs listed in `testing-strategy-phase-2.md §Display components` pass; existing e2e green.
**Commit:** `refactor(components): add display components on pi-tui primitives`

## Sub-phase 2.E — Prompt components

- Implement `src/components/prompts/*` for the 17 retained prompt types:
    - `input` — pi-tui `Input`.
    - `number`, `password`, `invisible` — `Input` with the appropriate filter/mask.
    - `list` — `Input` then comma-split.
    - `select`, `autoComplete` — `SelectList`.
    - `multiSelect` — `SelectList` with multi-pick.
    - `confirm` — thin wrapper over `SelectList[Yes/No]`.
    - `form`, `basicAuth` — sequenced `Input`s.
    - `toggle` — `SelectList[enabled-label, disabled-label]`.
    - `sort` — small custom Component using pi-tui primitives (reorder list).
    - `snippet` — template parsing + sequenced `Input`s.
- Drop `survey`, `scale`, `quiz` from `src/commands-schema.json` and `src/types/commands.ts`. Update `src/commands.json` if it references them.
- Unit specs per `testing-strategy-phase-2.md §Prompt components` — at least one happy-path test per retained prompt type.

**Exit criteria:** the listed prompt unit specs pass; existing e2e green.
**Commit:** `refactor(components): replace enquirer prompts with pi-tui wrappers`

## Sub-phase 2.F — Wire the new shell

- `src/shell/ShellLoop.ts` — read → tokenize via `string-argv` → `yargs.parse` → handler → repeat. Uses `PromptLine` for the idle state.
- `src/shell/PromptLine.ts` — renders the prompt segments + a pi-tui `Input` while no command is running.
- `src/commands/buildYargs.ts` — JSON tree → yargs commands. Mechanical port of `src/io/yargs/commandsToYargs.js`.
- `src/commands/runComponents.ts` — component-list dispatcher. Switch over `component.component`.
- `src/Protostar.ts` — public class. Wires `XtermTerminal` + `TUI` + `ShellLoop` + `buildYargs`. `start()`, `destroy()`.
- `src/index.ts` — re-exports `Protostar` and types.
- Add `index-new.html` + `src/index-new.ts` that boot the new stack against the same `commands.json`. Used for hand validation and the smoke test.
- Add `tests/e2e/new-smoke.spec.ts` per `testing-strategy-phase-2.md §Layer 3` — three assertions against the new entry; deleted in 2.G.

**Exit criteria:** new entry boots in dev, new smoke spec green, existing e2e (against the old entry) green.
**Commit:** `refactor(shell): wire new shell loop alongside legacy entry`

## Sub-phase 2.G — Cutover

- Replace `src/index.js` with `src/index.ts` (re-export from the new entry point) and have `index.html` load it.
- Replace `src/library.js` with `src/library.ts` re-exporting from `src/index.ts`. Update `vite.config.js` library entry.
- Update the dev-only test handle to `window.__protostar = { term, tui, shell, history, variables }`.
- Update the e2e helper module (`tests/e2e/helpers/terminal.ts` and `types.ts`) per the contract in `testing-strategy-phase-2.md §E2E continuity contract`. Helper signatures stay stable so no `*.spec.ts` file changes.
- Delete `tests/e2e/new-smoke.spec.ts` and `index-new.html` / `src/index-new.ts`.
- **Delete:** `src/io/LocalEchoController.js`, `src/io/HistoryController.js`, `src/io/Utils.js`, `src/io/inputHandler.js`, `src/io/yargs/initializeYargs.js`, `src/io/yargs/commandsToYargs.js`, `src/io/yargs/componentsToYargsHandler.js`, `src/shims/monkeyPatchStdout.js`, `src/shims/readlineShim.js`, `src/components/spinner/stopSpinner.js`, `src/components/text/interpolateVariables.js`, `src/utils/sleep.js`, `src/utils/getColoredText.js`, `src/Terminal.js`, `index-new.html`, `src/index-new.ts`.
- **Update `vite.config.js`:** drop the `readline` alias. Drop `vite-plugin-node-polyfills` if pi-tui can run with just the lighter shims; otherwise narrow `include` to whatever pi-tui actually needs (`process`, `events`, `perf_hooks`). Keep the cliui/yargs-parser CDN aliases if `yargs/browser` still requires them.
- **Uninstall:** `enquirer`, `ora`, `cli-progress`, `cli-table3`, `log-symbols`, `path`, `cliui`. Update `package.json`.
- Update `.claude/architecture.md` to describe the new module layout.

**Exit criteria:** existing Phase 1 e2e suite passes against the new stack. The 9 fixme'd specs may still be fixme'd at this point; they get flipped in 2.H. `npm run build` and `npm run build:lib` succeed. Bundle is measurably smaller (informal — record the number in the commit message).
**Commit:** `refactor: cut over to pi-tui shell, delete legacy LocalEchoController stack`

## Sub-phase 2.H — Bug cleanup + docs

- Flip each `test.fixme` to `test` per `testing-strategy-phase-2.md §Bug-fix verification matrix`. Run the full suite. Any flip that fails stays fixme'd and gets a fresh known-bugs entry recording what the refactor missed.
- Update `.claude/known-bugs.md` to mark resolved bugs as `Status: fixed in Phase 2`.
- Update `README.md` if any user-visible behavior changed (probably nothing — the schema is preserved). Note the dropped prompt types (`survey`/`scale`/`quiz`) prominently.
- Update `.claude/refactor-strategy.md`, `testing-strategy-phase-2.md`, and this plan doc with any deviations the implementation surfaced.

**Exit criteria:** suite at the highest pass count we can hit; any remaining fixmes have fresh known-bugs entries. Branch green.
**Commit:** `test(e2e): un-fixme bugs resolved by the refactor + docs`

## Rough sizing

| Sub-phase | Net new (LOC) | Net deleted (LOC) | Notes |
|---|---|---|---|
| 2.A | ~150 | 0 | Types + tsconfig |
| 2.B | ~150 | 0 | Adapter + first unit test |
| 2.C | ~250 | 0 | Five small modules + unit tests |
| 2.D | ~400 | 0 | Display components + unit tests |
| 2.E | ~500 | ~80 | Prompt components; schema entries removed |
| 2.F | ~250 | 0 | Wiring + smoke test |
| 2.G | ~50 | ~2000 | Cutover + deletes |
| 2.H | ~10 | ~10 | fixme flips + docs |

End state: `src/` shrinks materially. Five npm dependencies removed, one added. All seven known UX bugs fixed. Test surface unchanged.
