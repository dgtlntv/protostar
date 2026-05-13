# Phase 2 Implementation Plan — Refactor

Turns `.claude/refactor-strategy.md` into an ordered set of sub-phases. Continues on the existing `testing-strategy` branch (no new branch). Each sub-phase ends in a single commit on a green tree.

## Cross-cutting rules

- One commit per sub-phase. Same message style as Phase 1: short imperative title, blank line, 2–4 bullets summarizing what changed and why. Co-author Claude as before.
- The Phase 1 e2e suite is the cutover gate — sub-phases 2.A–2.F add new code without wiring it into the running app, so the suite keeps passing automatically. 2.G is the only commit where the suite has to keep passing under freshly cut-over code; that is where the design either holds or doesn't.
- New files are TypeScript. Old `.js` files keep working until they're deleted in 2.G.
- Every class, function, method, and exported type in files we touch or create gets proper JSDoc — production code and unit-test helpers. Functions document each parameter with `@param` and the result with `@returns` when applicable; throwing functions add `@throws`. Spec files only need a top-of-file summary; individual `describe`/`it` titles document the rest. Don't merely restate what types already say — describe purpose, invariants, edge cases, and non-obvious choices — but do write the tags so each parameter gets a line.
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

- `src/shell/ShellLoop.ts` — read → tokenize via `shell-quote.parse` (filter operator tokens before handing the resulting `string[]` to `yargs.parse`) → handler → repeat. Uses `PromptLine` for the idle state. `string-argv` is unused after this sub-phase and is uninstalled in 2.G.
- `src/shell/PromptLine.ts` — renders the prompt segments + a pi-tui `Input` while no command is running.
- `src/commands/buildYargs.ts` — JSON tree → yargs commands. Mechanical port of `src/io/yargs/commandsToYargs.js`.
- `src/commands/runComponents.ts` — component-list dispatcher. Switch over `component.component`.
- `src/Protostar.ts` — public class. Wires `XtermTerminal` + `TUI` + `ShellLoop` + `buildYargs`. `start()`, `destroy()`.
- `src/index.ts` — re-exports `Protostar` and types.
- Add `index-new.html` + `src/index-new.ts` that boot the new stack against the same `commands.json`. Used for hand validation and the smoke test.
- Add `tests/e2e/new-smoke.spec.ts` per `testing-strategy-phase-2.md §Layer 3` — three assertions against the new entry; deleted in 2.G.

**Exit criteria:** new entry boots in dev, new smoke spec green, existing e2e (against the old entry) green.
**Commit:** `refactor(shell): wire new shell loop alongside legacy entry`

## Sub-phase 2.F.5 — Parity polish + comparison harness

The cutover in 2.G **deletes the legacy stack**, so this is the last sub-phase
where side-by-side comparison between old and new is cheap. Goal: prove —
component by component — that the new stack reproduces the old one's
user-visible output, and either fix the divergences or record them as
known-bugs entries before they become invisible.

- **Coverage CLI.** Add `src/test-commands.json` (or extend `commands.json`)
  with a command per component type that exercises every meaningful option
  combination. Concretely: at least one command per entry in the `Component`
  union from `src/types/commands.ts` — `text` (with and without `duration`),
  `progressBar`, `spinner` (single phrase + array of phrases), `table` (auto
  width + explicit `colWidths`), `conditional` (true + false + nested),
  `variable` (declared + undeclared key), and one command per prompt type
  (`input`, `number`, `password`, `invisible`, `list`, `select`,
  `autoComplete`, `multiSelect`, `confirm`, `form`, `basicAuth`, `toggle`,
  `sort`, `snippet`). A `demo` parent command grouping the lot is fine.
- **Side-by-side harness.** Add `index-compare.html` + `src/index-compare.ts`
  that mounts the legacy `Terminal` and the new `Protostar` against the
  coverage CLI in a two-pane CSS grid (e.g. `grid-template-columns: 1fr 1fr`)
  so both run on the same page against the same `commands.json`. Each pane
  gets its own `#terminal-old` / `#terminal-new` host element. No keystroke
  syncing — the operator drives each pane independently. Deleted in 2.G
  alongside `index-new.html`.
- **Walk every command in both panes.** For each component, type the
  triggering command in both, observe the output, and record a one-line
  verdict — match / divergent (with the diff) / new-bug. The list lives in
  the commit message and feeds `.claude/known-bugs.md`.
- **Triage each divergence.** Three buckets:
  1. Quick fix in the new module — fix it here, add a unit test where the
     surface allows, no scope creep into other components.
  2. Genuinely needs the legacy stack gone first (e.g. depends on the new
     `window.__protostar` shape) — defer to 2.G with a TODO comment.
  3. Won't fix in Phase 2 — new known-bugs entry with a clear reason.
- **`BUG-001..007` are out of scope** — those flip in 2.H per the
  `testing-strategy-phase-2.md` matrix. Don't touch their fixmes here.

**Exit criteria:** every component in the coverage CLI has a recorded
verdict; divergences are either fixed (with tests) or filed as known-bugs
entries; existing e2e + unit suites still green; new-smoke spec still green.
**Commit:** `refactor: parity polish + comparison harness pre-cutover`

## Sub-phase 2.G — Cutover

- Replace `src/index.js` with `src/index.ts` (re-export from the new entry point) and have `index.html` load it.
- Replace `src/library.js` with `src/library.ts` re-exporting from `src/index.ts`. Update `vite.config.js` library entry.
- Update the dev-only test handle to `window.__protostar = { term, tui, shell, history, variables }`.
- Update the e2e helper module (`tests/e2e/helpers/terminal.ts` and `types.ts`) per the contract in `testing-strategy-phase-2.md §E2E continuity contract`. Helper signatures stay stable so no `*.spec.ts` file changes.
- Delete `tests/e2e/new-smoke.spec.ts` and `index-new.html` / `src/index-new.ts`. Also delete the 2.F.5 comparison harness: `index-compare.html`, `src/index-compare.ts`, and `src/test-commands.json` (if added as a separate file rather than folded into `commands.json`).
- **Delete:** `src/io/LocalEchoController.js`, `src/io/HistoryController.js`, `src/io/Utils.js`, `src/io/inputHandler.js`, `src/io/yargs/initializeYargs.js`, `src/io/yargs/commandsToYargs.js`, `src/io/yargs/componentsToYargsHandler.js`, `src/shims/monkeyPatchStdout.js`, `src/shims/readlineShim.js`, `src/components/spinner/stopSpinner.js`, `src/components/text/interpolateVariables.js`, `src/utils/sleep.js`, `src/utils/getColoredText.js`, `src/Terminal.js`, `index-new.html`, `src/index-new.ts`.
- **Update `vite.config.js`:** drop the `readline` alias. Drop `vite-plugin-node-polyfills` if pi-tui can run with just the lighter shims; otherwise narrow `include` to whatever pi-tui actually needs (`process`, `events`, `perf_hooks`). Keep the cliui/yargs-parser CDN aliases if `yargs/browser` still requires them.
- **Uninstall:** `enquirer`, `ora`, `cli-progress`, `cli-table3`, `log-symbols`, `path`, `cliui`, `string-argv`. Update `package.json`.
- Update `.claude/architecture.md` to describe the new module layout.

**Exit criteria:** structural cutover lands green; the new stack boots, the unit suite stays at 91/91, and the e2e suite is green with the parity-gap specs fixme'd against fresh known-bugs entries (BUG-015/016/017). `npm run build` and `npm run build:lib` succeed. Bundle is measurably smaller (informal — record the number in the commit message). The seven Phase-1 fixmes (BUG-001..007) remain fixme'd at this point; they're flipped in 2.H.
**Commit:** `refactor: cut over to pi-tui shell, delete legacy LocalEchoController stack`

## Sub-phase 2.G.5 — Shell parity rebuild + dependency hygiene + doc sweep

The cutover surfaced three behavior gaps in the new shell that the planned design didn't account for. This sub-phase closes them with proper, durable fixes (no back-compat shims) and bundles in the housekeeping work that's cheaper to do once on a clean post-cutover tree than spread across later sub-phases.

### Shell parity (BUG-015/016/017)

- **BUG-015 — Ctrl+C handling.** Add a `\x03` branch in `PromptLine.handleInput` (or a dedicated cancel hook on `ShellLoop`) that prints `^C` to scrollback, clears the live input + `ShellLoop.pending`, calls `history.rewind()`, and re-mounts a fresh prompt without pushing to history. Unit-test the cancel path against `virtualTerm`. Flip all four `tests/e2e/ctrl-c.spec.ts` specs and the two history specs that depend on `cancel()`.
- **BUG-016 — Multi-line continuation buffer.** Replace `PromptLine`'s single-line `Input` with a multi-line-aware prompt component that owns the full continuation buffer (newlines included) so cursor moves, Backspace, and Home/End operate against the whole buffer. On every edit, re-evaluate `isIncomplete(buffer)`; when it returns false, treat the next Enter as a submission and flush. Drop `ShellLoop.pending` once the prompt itself owns continuation state. Unit-test the cursor/edit semantics against `virtualTerm`. Flip the five `multiline-navigation.spec.ts` specs and the resize-during-continuation spec.
- **BUG-017 — Paste handling.** Intercept paste in `PromptLine` before pi-tui's `Input.handlePaste` runs: normalize `\r`/`\r\n` to `\n`, then split on `\n` and feed each shell-complete chunk to the dispatch path, leaving any trailing incomplete tail in the live editor. Unit-test the splitter against the test cases in `paste.spec.ts`. Flip the three paste specs (and recheck BUG-006's fixme — the new paste path may incidentally fix it; if so, mark BUG-006 fixed in 2.G.5 instead of 2.H).

Each fix gets a unit test under `tests/unit/` covering the new behavior surface. Existing happy-path tests stay green.

### Dependency hygiene

- **Audit.** Walk every entry in `package.json` `dependencies` + `devDependencies` and confirm it's actually imported somewhere under `src/` or `tests/`. Drop any orphan. Be ruthless — small dep tree is the win.
- **Update.** Run `npm outdated`, then bump every package to its latest stable. Run unit + e2e suites after each major. Record the bumps in the commit message.
- **`yargs/browser` shim re-evaluation.** After yargs updates, re-check whether `yargs/browser` still imports `cliui` / `yargs-parser` from `https://unpkg.com/...`. If not, drop the two CDN aliases in `vite.config.js`; if `cliui` is no longer transitively needed, uninstall it (the 2.G plan listed it for removal but it had to stay because of the unpkg import). Same check for the `node:module` / `node:perf_hooks` / `node:fs` / `node:os` / `node:path` / `child_process` / `fs` / `os` shims pi-tui needs — if a future pi-tui release tree-shakes its server-only modules, the shims can shrink.

### Doc sweep

Phase-progression and refactor-timing language is dead-on-arrival once the migration ships — nobody reading the code in six months cares which sub-phase added a file or what legacy library it replaced. Sweep every JSDoc comment, inline comment, and `.md` doc under `src/` and the project root (excluding `.claude/` planning docs, which are migration history by design) and remove:

- References to "Phase 1" / "Phase 2" / "sub-phase 2.X" / "the cutover" / "after Phase 2" etc.
- Mentions of replaced libraries by name (`enquirer`, `ora`, `cli-progress`, `cli-table3`, `log-symbols`, `string-argv`, `LocalEchoController`, `Terminal.js` legacy, etc.) and "legacy stack" / "old stack" framing.
- "Replaces the legacy X" / "until 2.G" / "deleted in 2.G" / "scheduled for fix in 2.X" comments — once the work is done the prose should describe what the code does today, not how it got there.

The memory entry `feedback_no_legacy_refs_in_docs.md` already governs new code; this sweep retroactively applies it.

**Exit criteria:** all 15 fixmes from 2.G flipped to passing; unit suite covers each parity fix; dep tree audited and updated; CDN aliases re-checked against the latest yargs; no Phase-progression or legacy-library references remain in `src/`, `tests/`, or root `.md` docs; e2e + unit + build all green.
**Commit:** `refactor: shell parity rebuild + dependency refresh + doc sweep`

## Sub-phase 2.H — Bug cleanup + parity fixes + docs

Bug cleanup (existing):

- Flip each `test.fixme` to `test` per `testing-strategy-phase-2.md §Bug-fix verification matrix`. Run the full suite. Any flip that fails stays fixme'd and gets a fresh known-bugs entry recording what the refactor missed.
- Update `.claude/known-bugs.md` to mark resolved bugs as `Status: fixed in Phase 2`.

Parity fixes surfaced by 2.F.5's comparison walkthrough (BUG-008/009/010/011/014 in `known-bugs.md`):

- **BUG-008** — single-row prompts. Add a shared `InlinePrompt` component (or extend `PromptLine`'s prompt-prefix-over-`Input` trick) so `input`/`number`/`password`/`invisible`/`list` and the per-field rows of `form`/`basicAuth` render the message and editable buffer on the same row.
- **BUG-009** — leading `?` swaps to a green `✔` on submit and the persisted answer renders in green (not muted). Touches `src/components/prompts/promptUtils.ts` `messageLine`/`answerLine`.
- **BUG-010** — replace `confirm`'s `SelectList[Yes/No]` with a custom `(Y/n)` keystroke component.
- **BUG-011** — replace `toggle`'s vertical `SelectList` with a horizontal Off/On layout driven by arrow-Left/Right with the active label underlined.
- **BUG-014** — rebuild `form` as a single multi-field component: every field visible at once, per-field state bullet (muted → green on submit), grayed-out placeholder text for `initial` values that Tab accepts and typing overrides, arrow-Up/Down to move between fields. Sizeable custom `Component`.

Each parity fix lands its own unit test in `tests/unit/prompt-components.spec.ts` covering the new behavior; existing happy-path tests stay green.

Schema/component drop:

- Drop `snippet` the same way `survey`/`scale`/`quiz` were dropped: remove it from `src/commands-schema.json`, from the `Component` discriminated union in `src/types/commands.ts`, from `runComponents`/`buildYargs` dispatch, from `tests/unit/helpers/componentHarness.ts`, and from `src/test-commands.json`. Delete `src/components/prompts/snippet.ts` and the snippet unit specs. The legacy `snippet` was broken anyway and the parity rebuild has been judged not worth the scope; authors using `snippet` need to migrate before consuming the new build.

Docs:

- Update `README.md` if any user-visible behavior changed. Note the dropped prompt types (`survey`/`scale`/`quiz`/`snippet`) prominently.
- Update `.claude/refactor-strategy.md`, `testing-strategy-phase-2.md`, and this plan doc with any deviations the implementation surfaced.

**Exit criteria:** suite at the highest pass count we can hit; any remaining fixmes have fresh known-bugs entries; BUG-008/009/010/011/014 marked `fixed in Phase 2` in `known-bugs.md`; snippet fully removed. Branch green.
**Commit:** `test(e2e): un-fixme bugs resolved by the refactor + parity polish + docs`

### Implementation notes (post-landing)

- **BUG-002 (Ctrl+Backspace).** Browser xterm sends raw `\x08` for Ctrl+Backspace and raw `\x7f` for plain Backspace. pi-tui's `ctrl+backspace` matcher only recognises Kitty / modifyOtherKeys sequences (raw `\x08` only matches in a Windows Terminal session), so the natural fix is to extend `tui.editor.deleteWordBackward` with `ctrl+h` (which pi-tui canonicalises to `\x08`). `Protostar` installs the override at module load via `setKeybindings(new KeybindingsManager(TUI_KEYBINDINGS, …))`; `PromptLine` and `InlinePrompt` check the word-delete keybinding before the char-delete one so the shared byte routes to word delete.
- **BUG-005 (cursor across wrap boundary).** `PromptLine.render` pre-wraps each logical line into rows of exactly `terminal.columns` visible cells (matching xterm's natural wrap) and places the cursor decoration at `(cursorVisibleCol / cols, cursorVisibleCol % cols)`. The line-wrap fixme flipped to passing. The wrap helpers (`wrapToRows`, `byteOffsetForVisibleCol`, `graphemeAt`) treat ANSI escape sequences as zero-width pass-through and use grapheme-aware cell counting so wide characters split rows cleanly.
- **`InlinePrompt`.** Lands as the foundation for BUG-008. Owns the editing primitives (grapheme-aware cursor moves, word-wise nav, bracketed paste, paste-strip-newlines) plus a render-mode flag (`plain` / `mask` / `hidden`) and an optional `accept` predicate. `MaskedInput` was deleted — `password`/`invisible`/`basicAuth` route through `InlinePrompt`. `awaitInputLine` was also deleted as a redundant wrapper; callers use `runInlinePrompt` directly.
- **Number prompt validation.** The user feedback flagged that the new `number` prompt accepted non-numeric keystrokes and produced `NaN` on submit. Fixed by passing an `accept` predicate to `InlinePrompt` that rejects anything outside `[0-9.\-+eE]`.
- **`autoComplete` match highlighting.** Configured the `SelectList`'s `truncatePrimary` callback so the matched prefix on each visible item is wrapped in cyan; the active filter is read from the `AutoCompleteCombo`.
- **`multiSelect` glyphs.** Replaced the `[ ]` / `[x]` text with a muted `◯` → green `✔` glyph pair to match the parity baseline.
- **Spinner reflow.** The pi-tui `Loader` rendered with `paddingX=1` and prepended an empty top row, which contributed to the "indented + extra blank row" feedback. Replaced with a custom `SpinnerLine` component that renders one row, no padding.

## Rough sizing

| Sub-phase | Net new (LOC) | Net deleted (LOC) | Notes |
|---|---|---|---|
| 2.A | ~150 | 0 | Types + tsconfig |
| 2.B | ~150 | 0 | Adapter + first unit test |
| 2.C | ~250 | 0 | Five small modules + unit tests |
| 2.D | ~400 | 0 | Display components + unit tests |
| 2.E | ~500 | ~80 | Prompt components; schema entries removed |
| 2.F | ~250 | 0 | Wiring + smoke test |
| 2.F.5 | ~150 | 0 | Coverage CLI + side-by-side harness; size depends on divergence-fix volume |
| 2.G | ~50 | ~2000 | Cutover + deletes |
| 2.G.5 | ~600 | ~100 | Shell parity rebuild (BUG-015/016/017), dep refresh, doc sweep |
| 2.H | ~600 | ~150 | fixme flips + parity fixes (BUG-008/009/010/011/014) + snippet drop + docs |

End state: `src/` shrinks materially. Five npm dependencies removed, one added (and the rest refreshed in 2.G.5). The seven Phase-1 UX bugs (BUG-001..007), the three shell-parity bugs surfaced by the cutover (BUG-015/016/017), and the five Phase-2 prompt-parity bugs (BUG-008/009/010/011/014) fixed; BUG-012/013 dropped as won't-fix; `snippet` removed alongside the originally planned `survey`/`scale`/`quiz` cuts. Test surface unchanged on the e2e side; unit suite gains specs for every parity fix.
