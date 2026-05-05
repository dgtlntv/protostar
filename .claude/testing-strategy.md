# Protostar Testing Strategy — Phase 1

## Goals & Scope

Phase 1 covers **end-to-end tests of the terminal editing UX layer only**: `LocalEchoController` + `HistoryController` + input handling, exercised through the real xterm.js terminal in a real browser.

This is the highest-risk surface (stateful input, cursor math, rendering) and the one that most directly affects whether the tool feels "right" to end users.

### Out of scope for phase 1
- Unit tests (deferred — a planned `LocalEchoController` refactor would invalidate them).
- Component/yargs layer (text, spinner, progress, table, prompts, variables) — phase 2.
- Autocomplete — not currently supported in protostar.
- `readChar` prompt mode — only reachable via the autocomplete "Display N possibilities?" prompt, so has no user-reachable trigger today.
- Flicker detection — deterministic tests require mechanism-level assertions (write-sequence inspection) that over-specify the current implementation; visual regression is too flaky for what flicker actually is (sub-frame transient rendering). Manual verification remains the check.
- Control-key fallthroughs (Ctrl+A, Ctrl+E, Ctrl+D, Ctrl+L, Shift+Tab) — no dedicated handlers exist today; they fall through to `default` and insert literal control chars. Pinning this "accidentally" locks us into undefined behavior. Revisit post-refactor.

## Tooling

- **Runner:** Vitest (chosen for future unit tests; Vite-native, zero-config).
- **E2E:** Playwright. Works well with the Vite dev server and has solid keyboard APIs.
- **Test handle:** the app exposes `window.__protostar` in dev/test builds, giving tests access to the xterm `Terminal` instance and the `LocalEchoController`. Primary assertion path is reading the xterm buffer:
  ```
  page.evaluate(() => window.__protostar.term.buffer.active.getLine(y).translateToString(true))
  ```
  Secondary: read `localEcho._input` / `localEcho._cursor` for asserting logical input state independent of visual rendering.
- No test-only command set initially — tests drive the default commands the app ships with. If stability becomes an issue, we'll add a minimal `echo`-style test command later.

## Pin-when-writing items

Behavior to confirm from the code at test-writing time, then pin:
- Home / End on multi-line input (whole-input bounds vs. current-visual-line).
- Ctrl+C while mid-input — cancelled input not added to history, history pointer rewound so next Up doesn't recall the partial.
- Up arrow when the user has typed a partial — does protostar preserve the partial or discard it?
- Multi-line paste containing a line with incomplete shell syntax — does it continue across the newline or submit as-is?

## Test Plan

Grouped by behavior area. Each test drives keystrokes via Playwright and asserts a combination of: xterm buffer contents, `_input` string, `_cursor` offset, and visible prompt position.

### 1. Prompt protection
- Backspace on empty input does nothing — prompt row unchanged, cursor at prompt end.
- Backspace spam (×20) on empty input — prompt unchanged.
- Type `abc`, Backspace ×5 — input cleared, prompt intact, cursor at prompt end.
- Delete (forward) on empty input does nothing.

### 2. Cursor navigation bounds
- Left on empty input — no movement into prompt.
- Type `hello`, Left ×10 — cursor at input start, no overshoot.
- Type `hello`, Home — cursor at input start.
- Type `hello`, Home, Right ×10 — cursor at input end, no overshoot.
- End from mid-input — cursor at input end.

### 3. Cursor navigation correctness (single-line)
- Type `hello`, Left ×2, type `X` → `helXlo`.
- Type `hello`, Home, type `X` → `Xhello`.
- Alt/Meta+Left on `hello world` from end lands at start of `world`.
- Alt/Meta+Left then type `X` on `hello world` → `hello Xworld`.
- Alt/Meta+Right from input start on `hello world` lands at end of `hello`.

### 4. Deletion correctness
- Type `hello`, Left ×2, Backspace → `helo`.
- Type `hello`, Home, Delete → `ello`.
- Type `hello`, Left ×2, Delete → `hell`.
- Type `hello`, End, Delete — no change.
- Ctrl/Alt+Backspace on `hello world ` at end — deletes `world ` (to previous word boundary).

### 5. History
- Submit `cmd1`, submit `cmd2`, Up — input shows `cmd2`.
- Up again — input shows `cmd1`.
- Up at oldest — stays at `cmd1`.
- Down — input shows `cmd2`.
- Down past newest — input blank.
- Type partial `par`, Up — partial replaced with history entry (pin current behavior when writing).
- Ring-buffer size: submit 12 commands (default size 10) — oldest two are gone.
- Duplicates: submit `cmd` twice — only one entry. Submit `cmd`, `other`, `cmd` — three entries.
- Type `partial`, Ctrl+C, Up — cancelled partial NOT recalled (pin at write time).

### 6. Multi-line continuation
- Type `echo "hi`, Enter — continuation prompt appears, not submitted.
- Continuing the above, type `there"`, Enter — submits `echo "hi\nthere"`.
- `echo hi &&`, Enter — continuation.
- `echo hi ||`, Enter — continuation.
- `echo hi |`, Enter — continuation.
- Input ending with `\\`, Enter — continuation.
- `echo "it\"s"`, Enter — submits (escaped quote doesn't open a new string).
- Up arrow after submitting a multi-line command recalls the whole multi-line input intact.

### 7. Multi-line cursor navigation
- On a two-line input, Left at column 0 of line 2 — cursor moves to end of line 1.
- On a two-line input, Right at end of line 1 — cursor moves to column 0 of line 2.
- Typing mid-line on line 2 inserts at the correct offset in `_input`.
- Backspace at column 0 of line 2 — joins the two lines.
- Home / End on multi-line — pin behavior when writing.

### 8. Line-wrap (single logical line longer than terminal width)
- Type input longer than terminal width, Left across wrap boundary — cursor lands on last column of previous visual row.
- Insert a character mid-input when wrapped — text after cursor reflows correctly, cursor remains at insertion point.

### 9. Enter / submit
- Enter on empty input — advances to new prompt row, no command executed, no error.
- Enter on a valid command — executes, prints output, new prompt.
- Enter on an unknown command — yargs error printed, new prompt.

### 10. Ctrl+C
- Type `partial`, Ctrl+C — `^C` printed, input cleared, new prompt.
- Ctrl+C on empty input — `^C`, new prompt.
- Ctrl+C mid-multiline-continuation — exits cleanly to a new prompt.
- Cancelled input NOT added to history (see section 5).

### 11. Paste
- Single-line paste into empty input — appears at cursor, no auto-submit.
- Paste into the middle of existing input — lands at cursor position.
- Multi-line paste `"line1\nline2\n"` — each `\r` runs Enter; each complete line submits as its own command.
- Paste with `\r\n` line endings — normalized, no extra newlines.
- Paste with mixed `\n` / `\r` / `\r\n` — normalized consistently.
- Paste containing a line with incomplete shell syntax — pin behavior when writing.

### 12. Ignored keys (no side effects)
- Escape, F1–F12, PageUp, PageDown — none insert characters or corrupt the prompt. One combined test sequence is sufficient.

### 13. Resize
- Resize window while input is empty — prompt remains intact, still editable.
- Resize with short single-line input — input stays correct, cursor position correct.
- Resize while input spans multiple wrapped visual lines — input re-wraps cleanly, cursor remains at the same logical offset.
- Resize during active multi-line continuation — reflows correctly.

## Approximate test count

~48 tests across 13 areas.

## Execution

- Playwright spins up the Vite dev server.
- A dedicated page builds the Terminal with `window.__protostar` exposed.
- Tests are grouped by area into files under `tests/e2e/` (one file per numbered section), run headless in CI.
