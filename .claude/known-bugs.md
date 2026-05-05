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
- **Suspected area:** `src/io/LocalEchoController.js:740-755` (`handleActiveInput` `"left"` / `"right"` cases check `key.meta`) combined with `src/io/Utils.js:214+` (`decodeANSIKeypressData`). xterm.js remaps Alt+Arrow to meta+b/f on macOS and to `\x1b[1;5D` (ctrl-left) on Linux; neither decodes to `{ name: "left", meta: true }`, so the word-boundary branch is unreachable from the keyboard on any platform.
- **Status:** open

### BUG-002: Ctrl+Backspace deletes only one character, not a word
- **Discovered in:** 1.C / `tests/e2e/deletion.spec.ts`
- **Symptom:** Ctrl+Backspace behaves like a plain Backspace — word-boundary deletion never runs.
- **Reproduction:** Type `hello world `, press Ctrl+Backspace — input becomes `hello world` instead of `hello `.
- **Suspected area:** `src/io/Utils.js:303-311` matches `\b` / `\x7f` as `backspace` and never sets `key.ctrl`, so `LocalEchoController.js:771` (`if (key.ctrl)`) is always false for keyboard-driven Backspace.
- **Status:** open

### BUG-003: History ring buffer drops the newest entry instead of the oldest
- **Discovered in:** 1.D / `tests/e2e/history.spec.ts`
- **Symptom:** Once the buffer reaches its size limit, new submissions are silently lost — older entries stick around forever instead of rolling off the front.
- **Reproduction:** With default size 10, submit `cmd1` … `cmd12`, then press Up repeatedly. Walking back lands on `cmd10` (then `cmd9`, …, `cmd1`); `cmd11` and `cmd12` are unreachable.
- **Suspected area:** `src/io/HistoryController.js:40` calls `this.entries.pop(0)`. `Array.prototype.pop` ignores its argument and removes the **last** element, so each overflow discards the just-pushed entry. Should be `this.entries.shift()`.
- **Status:** open

### BUG-004: Backslash-escaped quotes still trigger continuation
- **Discovered in:** 1.E / `tests/e2e/multiline-continuation.spec.ts`
- **Symptom:** Input with a backslash-escaped quote inside a string is treated as having an unclosed quote — Enter inserts a newline instead of submitting.
- **Reproduction:** Type `echo "it\"s"`, press Enter — protostar enters continuation. Bash would submit.
- **Suspected area:** `src/io/Utils.js:120` `(input.match(/"/g) || []).length % 2 !== 0` counts raw `"` characters with no awareness of `\"` escapes. Same issue applies to `'` on line 116.
- **Status:** open

### BUG-005: ArrowLeft across a wrap boundary does not move the cursor up a row
- **Discovered in:** 1.F / `tests/e2e/line-wrap.spec.ts`
- **Symptom:** When the input wraps onto a second visual row and the cursor is at col 0 of that row, ArrowLeft decrements `_cursor` correctly but the visible cursor stays put — it does not jump to the last column of the previous row.
- **Reproduction:** With cols=N, type N-15+5 chars (forces wrap past the prompt), Left back to offset N-15 (visual col 0 row 1 of the input), Left once more — `_cursor` becomes N-16 but the rendered cursor is still at col 0.
- **Suspected area:** `src/io/LocalEchoController.js:533-540` (`handleCursorMove(-1)`) emits a single `cursorBackward(1)` (CSI 1 D) regardless of position. CSI D at column 0 is a no-op per VT100, so the row never decrements. The fix is the same approach `setCursor` uses: compute target col/row via `applyPromptOffset` + `offsetToColRow` and write absolute movement when crossing rows.
- **Status:** open

### BUG-007: Escape key inserts a literal \x1b into the input
- **Discovered in:** 1.G / `tests/e2e/ignored-keys.spec.ts`
- **Symptom:** Pressing Escape with no active prompt-library readChar appends a literal `\x1b` byte to `_input`. The character is invisible in the rendered prompt, but `_input` is corrupted, so subsequent submission sends a stray ESC byte to yargs/string-argv.
- **Reproduction:** With an empty prompt, press Escape — `localEcho._input` becomes `"\x1b"`.
- **Suspected area:** `src/io/LocalEchoController.js:876` default branch in `handleActiveInput` calls `handleCursorInsert(data)` for any unrecognized key. `decodeANSIKeypressData("\x1b")` does not produce a `name` that matches one of the explicit cases, so the bare ESC byte falls through. Same family as the Ctrl-key fallthroughs already documented as out-of-scope in `testing-strategy.md`.
- **Status:** open

### BUG-006: Multi-line paste only submits the first complete line; rest is silently dropped
- **Discovered in:** 1.G / `tests/e2e/paste.spec.ts`
- **Symptom:** Pasting `cmd1\ncmd2\n` runs `cmd1` but `cmd2` is lost — protostar diverges from terminals like bash where each line in a multi-line paste runs sequentially.
- **Reproduction:** Paste `logout\nlogout\n` — the "You are not currently logged in." message appears once instead of twice, and no second prompt-with-`logout` is ever rendered.
- **Suspected area:** `src/io/LocalEchoController.js:692-698` (`handleTermData`) feeds normalized paste chars through `decodeTermData` in a synchronous `forEach`. The first `\r` whose preceding text is shell-complete calls `handleReadComplete`, which sets `_active = false`. The `inputHandler` only re-issues `read()` after the `.then()` microtask runs, which is *after* `forEach` finishes — so every paste char in between sees `_active === false` and falls through to the no-op `emit("keypress")` branch. A bracketed-paste-aware buffering layer that queues post-submit chars onto the next `read()` would fix this.
- **Status:** open
