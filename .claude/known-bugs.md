# Known Bugs

Bugs surfaced by the e2e suite. Each `test.fixme` in `tests/e2e/` links here by bug ID.

## Entry template

```
### BUG-###: <short title>
- **Discovered in:** <sub-phase / spec file>
- **Symptom:** <what the test observed>
- **Reproduction:** <keystroke sequence>
- **Suspected area:** <file:line if known>
- **Status:** open | fixed
```

### BUG-001: Alt+Arrow word navigation never triggers
- **Discovered in:** 1.C / `tests/e2e/cursor-correctness.spec.ts`
- **Symptom:** Alt+Left/Right moves the cursor by one character instead of jumping to the nearest word boundary.
- **Reproduction:** Type `hello world`, press Alt+Left — cursor moves from 11 to 10 instead of 6.
- **Status:** fixed in Phase 2. `PromptLine` consumes pi-tui's `tui.editor.cursorWordLeft` / `cursorWordRight` keybindings, which match the `\x1b[1;5D` / `\x1b[1;5C` and `\x1bb` / `\x1bf` sequences xterm emits for Alt+Arrow, so the word-boundary moves are reachable from the keyboard on all platforms.

### BUG-002: Ctrl+Backspace deletes only one character, not a word
- **Discovered in:** 1.C / `tests/e2e/deletion.spec.ts`
- **Symptom:** Ctrl+Backspace behaves like a plain Backspace — word-boundary deletion never runs.
- **Reproduction:** Type `hello world `, press Ctrl+Backspace — input becomes `hello world` instead of `hello `.
- **Status:** fixed in Phase 2. Browser xterm emits raw `\x08` for Ctrl+Backspace (and `\x7f` for plain Backspace). `Protostar` extends `tui.editor.deleteWordBackward` with `ctrl+h` (which pi-tui canonicalises to `\x08`); `PromptLine` and `InlinePrompt` check the word-delete keybinding before the char-delete one so the shared byte routes to word delete.

### BUG-003: History ring buffer drops the newest entry instead of the oldest
- **Discovered in:** 1.D / `tests/e2e/history.spec.ts`
- **Symptom:** Once the buffer reaches its size limit, new submissions are silently lost — older entries stick around forever instead of rolling off the front.
- **Reproduction:** With default size 10, submit `cmd1` … `cmd12`, then press Up repeatedly. Walking back lands on `cmd10` (then `cmd9`, …, `cmd1`); `cmd11` and `cmd12` are unreachable.
- **Status:** fixed in Phase 2. `HistoryStore.push` calls `this.entries.shift()` on overflow.

### BUG-004: Backslash-escaped quotes still trigger continuation
- **Discovered in:** 1.E / `tests/e2e/multiline-continuation.spec.ts`
- **Symptom:** Input with a backslash-escaped quote inside a string is treated as having an unclosed quote — Enter inserts a newline instead of submitting.
- **Reproduction:** Type `echo "it\"s"`, press Enter — protostar enters continuation. Bash would submit.
- **Status:** fixed in Phase 2. `isIncomplete` parses the buffer with `shell-quote.parse`, which honours backslash escapes inside strings.

### BUG-005: ArrowLeft across a wrap boundary does not move the cursor up a row
- **Discovered in:** 1.F / `tests/e2e/line-wrap.spec.ts`
- **Symptom:** When the input wraps onto a second visual row and the cursor is at col 0 of that row, ArrowLeft decrements `_cursor` correctly but the visible cursor stays put — it does not jump to the last column of the previous row.
- **Reproduction:** With cols=N, type N-15+5 chars (forces wrap past the prompt), Left back to offset N-15 (visual col 0 row 1 of the input), Left once more — `_cursor` becomes N-16 but the rendered cursor is still at col 0.
- **Status:** fixed in Phase 2. `PromptLine.render` pre-wraps each logical line into rows of exactly `terminal.columns` visible cells (matching xterm's natural wrap) and places the cursor decoration at `(cursorVisibleCol / cols, cursorVisibleCol % cols)`, so cursor moves cross row boundaries.

### BUG-007: Escape key inserts a literal \x1b into the input
- **Discovered in:** 1.G / `tests/e2e/ignored-keys.spec.ts`
- **Symptom:** Pressing Escape with no active prompt-library readChar appends a literal `\x1b` byte to `_input`. The character is invisible in the rendered prompt, but `_input` is corrupted, so subsequent submission sends a stray ESC byte to yargs/string-argv.
- **Reproduction:** With an empty prompt, press Escape — `localEcho._input` becomes `"\x1b"`.
- **Status:** fixed in Phase 2. `PromptLine` (and `InlinePrompt`) reject every C0 / DEL / C1 control byte by construction, so a bare `\x1b` never reaches the buffer.

### BUG-008: Inline prompts render the message and editable input on separate rows
- **Discovered in:** 2.F.5 / side-by-side comparison harness (`index-compare.html`)
- **Symptom:** Every prompt that resolves to a single line — `input`, `number`, `password`, `invisible`, `list`, plus the per-field rows of `form` and `basicAuth` — renders `? <message>` on one row and the editable buffer on the next. The legacy enquirer stack puts both on the same row (`? Message: ▮`).
- **Status:** fixed in Phase 2. New `InlinePrompt` component renders `? <message> <buffer>` on a single row with mask-mode support; `input` / `number` / `password` / `invisible` / `list` and `basicAuth` route through `runInlinePrompt`.

### BUG-009: `?` glyph and submitted value are not colored to match enquirer
- **Discovered in:** 2.F.5 / side-by-side comparison harness
- **Symptom:** Legacy prompts render the leading `?` in light blue while a prompt is open and replace it with a green `✔` once submitted; the user-typed text is shown in green. The new prompts render `? <message>` plain and use the muted theme color for the resolved value, with no glyph swap on submit.
- **Status:** fixed in Phase 2. `messageLine` colors the leading `?` light-blue (`promptOpenColor`); `answerLine` swaps the glyph to a green `✔` (`successColor`) and renders the captured answer in green.

### BUG-010: `confirm` uses a SelectList[Yes/No] instead of a `(Y/n)` keystroke prompt
- **Discovered in:** 2.F.5 / side-by-side comparison harness
- **Symptom:** Legacy `confirm` prints `? <message> (Y/n)` and resolves the moment the user presses `y` or `n`. The new prompt mounts a two-item `SelectList` and requires arrow + Enter.
- **Status:** fixed in Phase 2. New `ConfirmKey` focusable renders `(Y/n)` (or `(y/N)` when `initial === false`) and resolves on `y`/`Y`/`n`/`N`/Enter.

### BUG-011: `toggle` lays Off / On vertically instead of horizontally
- **Discovered in:** 2.F.5 / side-by-side comparison harness
- **Symptom:** Legacy `toggle` renders the two labels side-by-side with the active one underlined and arrow-Left/Right to switch. The new prompt reuses `SelectList`, which stacks vertically and uses arrow-Up/Down.
- **Status:** fixed in Phase 2. New `HorizontalToggle` focusable renders both labels on a single row with the active one underlined; arrow-Left/Right (and `h`/`l`/Tab) switches state.

### BUG-014: `form` does not match enquirer's all-fields-visible layout with placeholder suggestions
- **Discovered in:** 2.F.5 / side-by-side comparison harness
- **Symptom:** Legacy `form` renders a leading `?` + label per field with grayed-out placeholder text (Tab to accept, type to override), shows every field at once, and uses arrow-Up/Down to move between fields; submitting the focused row marks its bullet green. The new prompt sequences each field as a fresh inline `Input`: only one field is visible at a time, no per-field bullet/state, no Tab-to-accept-placeholder.
- **Status:** fixed in Phase 2. New `FormBlock` component owns every field's buffer + cursor; renders all rows at once with a per-row `◯` → `✔` bullet, grayed-out placeholder until the buffer is touched, Tab to accept the placeholder, and arrow-Up/Down to move between fields.

### BUG-015: Ctrl+C is not handled by the shell prompt
- **Discovered in:** 2.G / `tests/e2e/ctrl-c.spec.ts`, `tests/e2e/history.spec.ts`
- **Symptom:** Pressing Ctrl+C while a `PromptLine` is mounted has no effect — the partial input is preserved, no `^C` marker is rendered, no fresh prompt is drawn, and submitted-then-cancelled inputs don't gate history pushes correctly. Affected specs: all four `ctrl-c.spec.ts` tests, plus the `history.spec.ts` tests that depend on `cancel(page)` (consecutive-duplicate dedupe and "Ctrl+C followed by Up does not recall the cancelled partial").
- **Suspected area:** `src/shell/PromptLine.ts` — pi-tui's `Input` doesn't intercept Ctrl+C. Fix is a `handleInput` branch in `PromptLine` that, on `\x03`, prints `^C`, clears the live input + any `pending` continuation buffer in `ShellLoop`, calls `history.rewind()`, and re-mounts a fresh prompt without pushing to history.
- **Status:** fixed in Phase 2 (2.G.5). `PromptLine.handleInput` now intercepts `\x03` and fires `onCancel`; `ShellLoop.handleCancel` flushes `<prompt><value>^C` to scrollback, calls `history.rewind()`, and remounts a fresh prompt.

### BUG-016: Multi-line continuation buffer is not editable across line boundaries
- **Discovered in:** 2.G / `tests/e2e/multiline-navigation.spec.ts`, `tests/e2e/resize.spec.ts`
- **Symptom:** When the user enters a continuation (unclosed quote, trailing operator, etc.), already-submitted lines are stored in `ShellLoop.pending` and the next line is edited through a fresh single-line `Input`. Cursor cannot cross the `\n` boundary, Backspace at column 0 of line 2 does nothing instead of joining lines, Home/End operate on the current line rather than the whole multi-line buffer, and a resize mid-continuation drops the editable state.
- **Suspected area:** `src/shell/PromptLine.ts` (currently wraps single-line `Input`) and `src/shell/ShellLoop.ts` (splits the buffer across `pending` + live prompt). Fix is a multi-line-aware prompt component that owns the entire continuation buffer and re-evaluates `isIncomplete` on every edit so removing the trailing `\n` exits continuation cleanly.
- **Status:** fixed in Phase 2 (2.G.5). `PromptLine` was rewritten as a multi-line component owning the whole `value: string` (newlines included) with a single `cursor: number`; cursor moves, Backspace, and Home/End operate against the full buffer. `ShellLoop.pending` was deleted.

### BUG-017: Multi-line paste does not split into per-line submissions or normalize line endings
- **Discovered in:** 2.G / `tests/e2e/paste.spec.ts`
- **Symptom:** Pasting text containing `\n` / `\r` / `\r\n` into the prompt inserts the bytes verbatim into the live `Input` rather than (a) normalizing line endings, (b) running each shell-complete line as its own command, or (c) flowing into a continuation when the first line is incomplete. Three specs cover this: `\r\n` normalization, mixed `\n`/`\r`/`\r\n` normalization, and "Multi-line paste with an incomplete first line continues across the newline".
- **Suspected area:** `src/shell/PromptLine.ts` — Fix is a paste interceptor in `PromptLine` (or a dedicated paste-buffer layer in `ShellLoop`) that normalizes line endings, splits on `\n`, submits each shell-complete chunk, and forwards any trailing incomplete tail into the live editor.
- **Status:** fixed in Phase 2 (2.G.5). `PromptLine.handlePaste` runs both bracketed (`\x1b[200~ ... \x1b[201~`) and raw-bytes paste content through line-ending normalization and per-segment dispatch; the trailing tail becomes the live remainder.

### BUG-006: Multi-line paste only submits the first complete line; rest is silently dropped
- **Discovered in:** 1.G / `tests/e2e/paste.spec.ts`
- **Symptom:** Pasting `cmd1\ncmd2\n` runs `cmd1` but `cmd2` is lost — protostar diverges from terminals like bash where each line in a multi-line paste runs sequentially.
- **Reproduction:** Paste `logout\nlogout\n` — the "You are not currently logged in." message appears once instead of twice, and no second prompt-with-`logout` is ever rendered.
- **Status:** fixed in Phase 2 (2.G.5). The new `PromptLine.handlePaste` emits each shell-complete segment through `onComplete([...])`; `ShellLoop` queues the lines and drains them sequentially. As a side fix, `ShellLoop.dispatch` now awaits the Promise returned by `yargs.parse` (rather than only the parseFn callback) so the next `parse` call doesn't re-enter while yargs is still frozen — without that, the second submission was misparsed as an unknown argument to the first.
