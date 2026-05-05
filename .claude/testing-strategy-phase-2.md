# Phase 2 Testing Strategy

Phase 2 keeps three test layers running in parallel. They do distinct work; none of them is a duplicate signal for the others.

## Layer 1 — Phase 1 e2e suite (cutover gate, unchanged surface)

The 63 specs under `tests/e2e/` describe user-visible behavior — typing, history, paste, multi-line, resize, ignored keys. The spec files do not touch internals; the only coupling is in the helper module:

- `helpers/terminal.ts` `getInput(page)` reads `localEcho._input`.
- `helpers/terminal.ts` `getCursor(page)` reads `localEcho._cursor`.
- `helpers/types.ts` declares the `window.__protostar` shape.

Sub-phase 2.G updates those three locations to read the equivalent fields off the new `shell` object. Every `*.spec.ts` file under `tests/e2e/` is unchanged across the cutover.

The suite is the cutover gate: 2.G is not done until every passing Phase 1 spec still passes. The 9 `test.fixme`s covering BUG-001 through BUG-007 are flipped in 2.H, not 2.G.

## Layer 2 — Vitest unit tests (written in lockstep with 2.B–2.E)

Phase 1 deliberately deferred unit tests because the refactor was incoming and any tests pinned to `LocalEchoController`'s shape would have been thrown out. After Phase 2 the surface stabilizes — each new module is small and pure enough to test in isolation, and that's where unit tests pay their design dividend. They cover what e2e cannot: branch-by-branch verification of parsers, evaluators, ring buffers, plus per-component prompt resolution against a virtual terminal.

Unit tests are also what makes 2.B–2.F land green ahead of an integration signal. Without them every new module would be unverified until 2.G's cutover, which is the one place the whole design either holds or doesn't.

### Setup (lands in 2.B)

- Runner: Vitest. Add `vitest`, `@vitest/ui` to `devDependencies`. Config at `vitest.config.ts` — JSDOM environment, glob `tests/unit/**/*.spec.ts`, no Playwright globals.
- Unit specs live in `tests/unit/`. Helpers under `tests/unit/helpers/`.
- `tests/unit/helpers/virtualTerm.ts` — instantiates `@xterm/headless` + `XtermTerminal` + a pi-tui `TUI`, exposes `render(component)`, `drive(keys)`, `getBufferText()`, `getCursorXY()`. Modeled on `pi-mono/packages/tui/test/virtual-terminal.ts`, trimmed to what unit tests need.
- Add npm scripts: `test:unit`, `test:unit:ui`. The CI workflow runs both `test:unit` and `test:e2e`.

### Per-module test inventory

The following lists are the exit criteria for each sub-phase. A sub-phase is not green unless its module list passes.

#### XtermTerminal (2.B)

- `write(s)` data reaches the xterm buffer.
- `columns` / `rows` getters track the underlying `term.cols` / `term.rows`.
- `start(onInput, onResize)` invokes `onInput` for `term.onData` data and `onResize` for `term.onResize` events.
- `clearScreen()`, `hideCursor()`, `showCursor()`, `clearLine()`, `clearFromCursor()`, `moveBy()` emit the documented ANSI sequences.
- `drainInput()`, `setProgress()`, `setTitle()`, `kittyProtocolActive` are safe no-ops.

#### HistoryStore (2.C)

- `push` then `getPrevious` walks backward; pinning oldest entry at the oldest position.
- `getNext` walks forward; past-newest returns `undefined`.
- Consecutive-duplicate dedupe.
- Non-consecutive duplicates are kept.
- Ring buffer at overflow drops the **oldest** entry, not the newest (proves BUG-003 fixed).
- `rewind` resets the cursor to the length.

#### VariableStore (2.C)

- `set` / `get` round-trips a value.
- `set` on an undeclared key reports rejection without throwing.
- `entries()` returns the snapshot used by `interpolate`.

#### interpolate (2.C)

- `{{var}}` is replaced by the value from the merged `{ ...argv, ...variables }` context.
- argv keys shadow variable keys.
- Unknown keys render to empty string (current behavior pinned).

#### evalCondition (2.C)

- Each supported operator returns the expected boolean: `===`, `!==`, `==`, `!=`, `&&`, `||`, `!`.
- Precedence: `!` > `&&` > `||`. Parens override.
- Identifier lookup against `{ ...argv, ...variables }`.
- String and number literals.
- **Rejection** (throws): function calls, dotted property access, assignment, `new`, ternary, regex literals. The old `new Function(...)` would accept all of these; the new evaluator must not.

#### isIncomplete (2.C)

- Empty string → `false`.
- Unclosed `"` and `'` → `true`.
- Trailing `&&`, `||`, `|` → `true`.
- Trailing `\` → `true`.
- **Escape-aware:** `echo "it\"s"` → `false` (proves BUG-004 fixed).
- Escaped operators don't trigger continuation: `echo \&&` → `false`.

#### Display components (2.D)

For each of `text`, `progressBar`, `spinner`, `table`, `variable`, `conditional`:

- Mounted on the virtual terminal, rendered output matches the expected lines.
- Variable interpolation runs where it's supposed to (cross-reference the matrix in `refactor-strategy.md`).
- `duration` sleeps for the documented time (use `vi.useFakeTimers`).
- `conditional` recurses into the correct branch.
- `variable` mutates the store and rejects undeclared keys.
- `table` honors `colWidths` and falls back to content-based widths when absent.
- `progressBar` reaches 100% by the end of `duration`.
- `spinner` swaps phrases when `output` is an array.

#### Prompt components (2.E)

For each of the 17 retained prompt types:

- Mounting renders the message + input UI on the virtual terminal.
- Happy-path keystrokes resolve to the expected value.
- Cancel keystrokes (where applicable) reject or return undefined consistently.
- The resolved value lands in `VariableStore[component.name]`.

Coverage target: at least one happy-path test per prompt type. `confirm` / `toggle` get y/n + enabled/disabled label coverage.

## Layer 3 — Pre-cutover e2e smoke (added in 2.F, deleted in 2.G)

`tests/e2e/new-smoke.spec.ts`. Boots `index-new.html` (the temporary entry running the new stack alongside the old one). Three assertions:

- The prompt renders.
- `logout` runs and prints "You are not currently logged in."
- A second prompt appears after the command finishes.

Catches integration-level breakage (vite config, polyfills, addon wiring) before the 2.G cutover. Deleted along with `index-new.html` in 2.G.

## E2E continuity contract

Every Phase 1 spec is unchanged across the cutover. The only places that touch internals:

- `tests/e2e/helpers/terminal.ts` — `getInput`, `getCursor`, and any helper that reaches into `localEcho`. Updated in 2.G to read the new equivalents.
- `tests/e2e/helpers/types.ts` — `LocalEchoHandle` and `ProtostarHandle` interfaces. Replaced with the new shape.
- `window.__protostar` — `term` stays. `localEcho` is replaced by `{ tui, shell, history, variables }`. Concrete field names land at implementation time and are recorded in the 2.G commit.

If a spec must change shape because behavior shifts (e.g. a fixme flips because the bug is fixed), that change happens in 2.H, not 2.G.

## Bug-fix verification matrix

Each entry in `.claude/known-bugs.md` is proven fixed (or proven still broken) by a specific test in 2.H:

| Bug | Proof |
|---|---|
| BUG-001 (alt+arrow word nav) | Three fixme'd specs in `cursor-correctness.spec.ts` flip to passing. |
| BUG-002 (ctrl+backspace word delete) | Fixme'd spec in `deletion.spec.ts` flips. |
| BUG-003 (history drops newest) | Unit test in `tests/unit/history-store.spec.ts` (2.C) + ring-buffer fixme in `history.spec.ts` flips. |
| BUG-004 (escaped quotes) | Unit test in `tests/unit/is-incomplete.spec.ts` (2.C) + fixme in `multiline-continuation.spec.ts` flips. |
| BUG-005 (left-arrow on wrap) | Fixme in `line-wrap.spec.ts` flips. No unit test — visual cursor position is an integration concern. |
| BUG-006 (multi-line paste loss) | Fixme in `paste.spec.ts` flips. |
| BUG-007 (Escape inserts \x1b) | Fixme in `ignored-keys.spec.ts` flips. |

Any flip that fails in 2.H stays fixme'd. The corresponding bug entry is updated to record what the refactor missed instead of being deleted.

## Out of scope

- **Visual regression** — same reasoning as Phase 1: sub-frame transient rendering over-specifies the implementation.
- **Performance baselines** — sanity-check informally; no formal budget.
- **Component/yargs Phase 2 e2e expansion** mentioned in the original Phase 1 strategy. That work targeted *e2e* component coverage; with unit tests covering each component file, e2e expansion is deferred until the new surface stabilizes.
- **Bracketed-paste protocol parsing** — verified end-to-end by the existing `paste.spec.ts`; we do not separately unit-test pi-tui's protocol parser.
