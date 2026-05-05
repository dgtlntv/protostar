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
