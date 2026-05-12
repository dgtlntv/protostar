# Changelog

## Unreleased

### Monorepo restructure

Converted from a single-package npm project to a **pnpm workspace** with three packages:

| Package | Path | Published | Purpose |
|---|---|---|---|
| `@dgtlntv/protostar` | `packages/protostar/` | Yes | Core library: shell, components, types |
| `@dgtlntv/protostar-codec` | `packages/protostar-codec/` | Yes | URL encoder/decoder for shareable prototypes |
| `@dgtlntv/playground` | `packages/playground/` | No (private) | Dev playground and GitHub Pages demo |

All build, test, and CI commands now use **pnpm** instead of npm.

### TypeScript migration

Migrated the entire codebase from JavaScript to TypeScript with strict type checking.

### Shell rewrite with pi-tui

Rewrote the shell layer on top of [pi-tui](https://github.com/niclas-niclas-niclas/pi-tui), replacing the legacy `local-echo` controller. Fixes:

- **Multi-line editing**: continuation buffers are fully editable across line boundaries
- **Multi-line paste**: normalized, split on newlines, dispatched sequentially (matching bash)
- **Word navigation**: Alt+Arrow jumps to word boundaries, Ctrl+Backspace deletes a word
- **Ctrl+C**: cancels running commands or clears the prompt with `^C`
- **History ring buffer**: fixed overflow dropping newest entries instead of oldest
- **Escape-aware continuation**: backslash-escaped quotes no longer trigger false continuations
- **Cursor across wrap boundaries**: ArrowLeft/Right moves correctly between visual rows
- **Escape key**: no longer inserts a literal `\x1b` into the buffer

### Prompt component overhaul

Rebuilt all interactive prompts to match enquirer's visual layout:

- **Inline prompts** (`input`, `number`, `password`, `invisible`, `list`, `basicAuth`): message and input on a single row, colored `?` swaps to `✔` on submit
- **`confirm`**: `(Y/n)` keystroke prompt instead of a select list
- **`toggle`**: horizontal labels with Left/Right switching instead of a vertical list
- **`form`**: all fields visible at once with `◯`/`✔` bullets, placeholders, and Tab-to-accept

### Removed prompt types

Removed `quiz`, `survey`, `scale`, and `snippet` from the schema and runtime.

### URL-shareable prototypes

New `@dgtlntv/protostar-codec` package for sharing prototypes via URL:

- Configs are validated, deflate-compressed, and base64url-encoded into a `#p1=...` URL fragment
- The playground decodes the hash on boot; invalid hashes fall back to the bundled demo with an error
- `protostar-encode` CLI reads JSON from stdin and writes a share URL to stdout
- Decoded payloads capped at 256 KiB; informational banner on URL-loaded prototypes
- Ctrl+Shift+L copies a share URL to the clipboard

### Self-contained library bundle

The `@dgtlntv/protostar` library build now bundles all runtime dependencies including Node shims. Consumers can `npm install @dgtlntv/protostar` and use it without any Vite/webpack alias configuration.

### Test suites

Two test suites run on every PR:

- **Unit** (Vitest): shell primitives, xterm adapter, display components, prompt components
- **E2E** (Playwright): terminal editing, history, Ctrl+C, multi-line, paste, line wrap, resize, component happy paths

### Linting

Added ESLint 9 with `@typescript-eslint/recommended-type-checked` rules across the workspace.
