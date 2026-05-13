# Phase 1 Implementation Plan — E2E Terminal Editing UX

Turns `testing-strategy.md` phase 1 into an ordered set of sub-phases. Each sub-phase ends in a **single commit** on the `testing-strategy` branch that leaves the repo in a green state. Tests are written in **TypeScript** — protostar will migrate to TypeScript long term, and the test tree is the first foothold.

## Commit discipline

- One commit per sub-phase. Do not combine.
- Commit message format: short title (imperative), blank line, 2–4 bullets summarizing what was added/changed and why.
  ```
  <sub-phase title>

  - <what was added>
  - <why, if non-obvious>
  - <exit criteria met, e.g. "48 e2e tests green locally">
  ```
- No `test.only` committed. `test.fixme` is allowed but must reference an entry in `.claude/known-bugs.md`.

## Known-bug tracking

Instead of filing GitHub issues, track test-exposed bugs in `.claude/known-bugs.md`. Every `test.fixme` links to an entry there. Entry format:

```
### BUG-###: <short title>
- **Discovered in:** <sub-phase / spec file>
- **Symptom:** <what the test observed>
- **Reproduction:** <keystroke sequence>
- **Suspected area:** <file:line if known>
- **Status:** open | fixed
```

## Sub-phase 1.A — Test infrastructure

Get Playwright running against the app with zero real tests. No behavior assertions yet — prove the harness can launch the app, reach the terminal, and read it.

- Add dev dependencies: `@playwright/test` (ships its own types, so no `@types/playwright` needed), `typescript`, `@types/node`. Playwright compiles `.ts` specs natively — no `ts-node` / `tsx` required.
- Add `tsconfig.json` scoped to the test tree (or a `tests/tsconfig.json`) — strict, target ES2022, `module: "ESNext"`, `moduleResolution: "Bundler"`. Do not migrate `src/` in this sub-phase.
- Add `playwright.config.ts`: chromium-only for phase 1, `webServer` pointing at `npm run dev`, default base URL `http://localhost:5173`.
- Add `tests/e2e/` directory and a `smoke.spec.ts`: navigates to `/`, waits for the prompt banner to appear in the xterm buffer, asserts the prompt is present. Nothing else.
- Add scripts to `package.json`: `test:e2e`, `test:e2e:ui`, `test:e2e:headed`.
- Add to `.gitignore`: `test-results/`, `playwright-report/`, `blob-report/`, `playwright/.cache/`.
- Create an empty `.claude/known-bugs.md` with a heading and the entry template.

**Exit criteria:** `npm run test:e2e` passes the smoke test headless.

**Commit:** `test: set up Playwright + TypeScript e2e harness`

## Sub-phase 1.B — Test handle + helpers

Expose `window.__protostar` in dev builds and build the helper layer every later test uses.

- Modify `src/index.js` (dev-only, `if (import.meta.env.DEV)`) to attach `window.__protostar = { term, localEcho }` after `Terminal.init()`.
- Add `tests/e2e/helpers/types.ts` — ambient types for the `window.__protostar` handle so test code is strictly typed.
- Add `tests/e2e/helpers/terminal.ts` exporting:
  - `waitForPrompt(page)` — resolves when a new prompt line is ready.
  - `type(page, text)` — `page.keyboard.type` (respects protostar's paste threshold of `data.length > 3`).
  - `paste(page, text)` — explicit paste path for paste tests (bypasses `keyboard.type`).
  - `press(page, key, modifiers?)` — wraps `page.keyboard.press`.
  - `getInput(page)`, `getCursor(page)` — read `localEcho._input` / `_cursor`.
  - `getBufferLine(page, y)`, `getBufferText(page)` — rendered text.
  - `submit(page)`, `cancel(page)` — Enter / Ctrl+C with prompt-wait.
- Add `tests/e2e/helpers/assertions.ts`: `expectPrompt`, `expectInput`, `expectCursor`.
- Rewrite the smoke test against the helpers — proves the layer works.

**Exit criteria:** smoke test still green, now written through helpers.

**Commit:** `test: add window.__protostar handle and typed e2e helpers`

## Sub-phase 1.C — Core editing on a single line

Sections 1, 2, 3, 4, 9 of `testing-strategy.md`. All single-line — keeps cursor math simple while the harness settles.

- `tests/e2e/prompt-protection.spec.ts` — section 1 (4 tests).
- `tests/e2e/cursor-bounds.spec.ts` — section 2 (5 tests).
- `tests/e2e/cursor-correctness.spec.ts` — section 3 (5 tests).
- `tests/e2e/deletion.spec.ts` — section 4 (5 tests).
- `tests/e2e/enter-submit.spec.ts` — section 9 (3 tests).

If a helper needs extending, extend it here rather than later.

**Exit criteria:** 22 tests green (or `test.fixme` with `known-bugs.md` links).

**Commit:** `test(e2e): cover single-line editing, bounds, deletion, submit`

## Sub-phase 1.D — History + Ctrl+C

Sections 5 and 10. Grouped because the history-rewind-on-cancel behavior couples them. Resolves the "partial-on-Up" and "Ctrl+C + history pointer" pinned items.

- `tests/e2e/history.spec.ts` — section 5 (9 tests).
- `tests/e2e/ctrl-c.spec.ts` — section 10 (4 tests).

**Exit criteria:** 13 more tests green. `testing-strategy.md` updated with the two resolved pins.

**Commit:** `test(e2e): cover history navigation and Ctrl+C cancellation`

## Sub-phase 1.E — Multi-line continuation and navigation

Sections 6 and 7. Cursor math gets real. Resolves the Home/End-on-multi-line pin.

- `tests/e2e/multiline-continuation.spec.ts` — section 6 (8 tests).
- `tests/e2e/multiline-navigation.spec.ts` — section 7 (5 tests).

**Exit criteria:** 13 more tests green. `testing-strategy.md` updated with the Home/End pin.

**Commit:** `test(e2e): cover multi-line continuation and cursor traversal`

## Sub-phase 1.F — Line wrap + resize

Sections 8 and 13. Set a deterministic viewport in these specs so wrap points are predictable.

- `tests/e2e/line-wrap.spec.ts` — section 8 (2 tests).
- `tests/e2e/resize.spec.ts` — section 13 (4 tests).

**Exit criteria:** 6 more tests green. If resize is flaky, use `test.describe.configure({ retries: 2 })` and note it — don't quietly weaken assertions.

**Commit:** `test(e2e): cover line wrapping and terminal resize`

## Sub-phase 1.G — Paste + ignored keys

Sections 11 and 12. Paste uses the `paste` helper so the `data.length > 3` threshold in `handleTermData` triggers. Resolves the "paste with incomplete line" pin.

- `tests/e2e/paste.spec.ts` — section 11 (6 tests).
- `tests/e2e/ignored-keys.spec.ts` — section 12 (1 combined test).

**Exit criteria:** 7 more tests green. Full suite ≈ 48 tests. `testing-strategy.md` updated with the paste pin.

**Commit:** `test(e2e): cover paste handling and ignored keys`

## Sub-phase 1.H — CI + docs

- Add a GitHub Actions workflow: install deps, install Playwright browsers, run `npm run test:e2e`, upload `playwright-report/` as an artifact on failure.
- Update `README.md` with a "Running tests" section.
- Remove the "Write tests" TODO at the top of `Terminal.js`.
- Update `.claude/architecture.md` testing-state line from "No tests exist" to reference the suite.

**Exit criteria:** CI runs the suite on every PR. Branch green.

**Commit:** `ci: run Playwright e2e suite on PRs + update docs`

## Cross-cutting rules

- One commit per sub-phase on `testing-strategy`.
- Tests are TypeScript. `src/` migration is NOT part of phase 1.
- If a test exposes a bug: add an entry to `.claude/known-bugs.md`, mark the test `test.fixme` referencing the bug ID, move on. Do not block the sub-phase.
- Pinning a behavior (sections 5, 7, 11) means: read the code, write the assertion for actual behavior, record the decision in `testing-strategy.md` in the same sub-phase.
- Do not refactor `LocalEchoController` during phase 1. It happens later, using this suite as the safety net.

## Rough size

| Sub-phase | Tests added | Running total |
|---|---|---|
| 1.A | 1 (smoke) | 1 |
| 1.B | 0 (rewritten) | 1 |
| 1.C | 22 | 23 |
| 1.D | 13 | 36 |
| 1.E | 13 | 49 |
| 1.F | 6 | 55 |
| 1.G | 7 | 62 |
| 1.H | 0 | 62 |

(Count exceeds the ~48 in `testing-strategy.md` because a few "one test" items map more naturally to multiple Playwright `test(...)` calls.)
