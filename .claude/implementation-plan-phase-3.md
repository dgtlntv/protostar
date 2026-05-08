# Phase 3 Implementation Plan — Monorepo split + URL-shareable prototypes

Splits the current single-package repo into a pnpm workspace with three packages, then lands the URL-loader feature so that a base64url-encoded, deflate-compressed Protostar JSON in the page hash boots the playground against that JSON instead of the bundled demo. The codec that produces and consumes those URLs is published as its own package so that an agent skill can generate share links without pulling in the library bundle.

Each sub-phase ends in a single commit on a green tree, on a fresh branch off `main`. The order is chosen so that every commit boundary keeps the existing e2e suite passing, and so that the codec is fully tested in isolation before any playground code depends on it.

## Cross-cutting rules

- One commit per sub-phase. Same message style as Phases 1 and 2: short imperative title, blank line, 2–4 bullets summarizing what changed and why. Co-author Claude as before.
- The repo switches from npm to pnpm in 3.A. After that, **no script, doc, or workflow may invoke `npm`** — `pnpm` only. CI, README, and `.claude/` docs all migrate together.
- New code is TypeScript. Every class, function, method, and exported type in files we touch or create gets proper JSDoc — production code, codec, unit-test helpers. Spec files only need a top-of-file summary; individual `describe`/`it` titles document the rest. Don't restate what types already say — describe purpose, invariants, edge cases, and non-obvious choices.
- The Phase 1/2 e2e suite is the cutover gate at every sub-phase boundary. 3.B and 3.C are the two phases where the suite is most at risk (paths and configs move underneath it); plan to run it locally as part of the commit, not just in CI.
- Test responsibilities (per-package unit tests, build-smoke layer, new e2e specs for the URL loader) are spelled out in `.claude/testing-strategy-phase-3.md`. Each sub-phase below references the relevant section there for its exit criteria; this file only restates what's distinctive.
- AJV is a runtime dep of the codec only. The `protostar` library does not depend on AJV. The `playground` consumes AJV transitively through the codec; that is fine because the playground bundles for the browser and is not republished.
- No `format` keywords in `commands-schema.json` today, so no `ajv-formats`. If a future schema change adds one, that's the time to add it — not now.
- No drive-by refactors inside structural sub-phases. If 3.B reveals a smell, file it; do not fix it as part of the move.
- Every sub-phase that changes a published package's surface (3.D, 3.E) gets a corresponding bullet in `README.md` in the same commit.

## Sub-phase 3.A — pnpm workspace skeleton (no code moves)

Lays the workspace plumbing without touching the source tree. After this commit, the repo still builds and tests exactly as before, but via pnpm.

- Add `pnpm-workspace.yaml` declaring `packages: ["packages/*"]`. The `packages/` directory does not exist yet — that's deliberate.
- Delete `package-lock.json`, generate `pnpm-lock.yaml` via a clean `pnpm install`.
- Add `tsconfig.base.json` at repo root with the current `strict: true`, `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `noEmit: true` settings. Existing `tsconfig.json` extends it. (Per-package tsconfigs land in 3.B/3.C/3.E.)
- Update `.github/workflows/test.yml` and `.github/workflows/deploy.yml` to use pnpm:
  - Add `pnpm/action-setup@v3` with `version: 9` (or whatever's pinned in `package.json` `packageManager` field).
  - Change `actions/setup-node@v4` cache to `"pnpm"`.
  - Replace `npm ci` with `pnpm install --frozen-lockfile`.
  - Build/test/artifact paths unchanged for now (`npm run build` becomes `pnpm build`, still produces `./dist`).
- Pin pnpm version via `"packageManager": "pnpm@9.x.x"` in root `package.json`.
- Update README install/build/test commands to pnpm. Update `.claude/architecture.md` "Entry Points" line that references `npm run build`.

**Exit criteria:** `pnpm install` from a clean checkout produces a deterministic lockfile. `pnpm dev`, `pnpm build`, `pnpm test:unit`, `pnpm test:e2e` all behave exactly as their npm equivalents did before. CI green.
**Commit:** `chore: switch repo from npm to pnpm`

## Sub-phase 3.B — Extract `@dgtlntv/protostar` library package

Moves the library source — everything that ships in `dist/index.es.js` today — into its own workspace package. The playground (still at repo root) becomes a workspace consumer of the lib.

- Create `packages/protostar/` with:
  - `package.json` — `name: "@dgtlntv/protostar"`, `version: "0.0.1"`, `type: "module"`, the existing `main`/`module`/`exports`/`files` fields, and only the lib's runtime deps (`@earendil-works/pi-tui`, `@xterm/*`, `chalk`, `cliui`, `shell-quote`, `yargs`, `yargs-parser`). Move `vitest`, `typescript`, `vite`, `@types/*` into the package's `devDependencies`.
  - `tsconfig.json` extending `../../tsconfig.base.json`.
  - `vite.config.ts` containing only the lib build (the current `getLibConfig` path), with the existing `resolve.alias` block for the pi-tui shims. Strip the dev/app config — that moves to the playground in 3.C.
  - `vitest.config.ts` mirroring the current root config; unit tests for lib code move with the source.
- Move source files:
  - `src/Protostar.ts`, `src/library.ts`, `src/styles.css` → `packages/protostar/src/`.
  - `src/shell/`, `src/tui/`, `src/components/`, `src/commands/`, `src/types/`, `src/shims/` → `packages/protostar/src/`.
  - Existing unit tests under `tests/unit/` that exercise lib code → `packages/protostar/tests/unit/`. Helpers (`virtualTerm.ts`, `componentHarness.ts`) move with them.
- The playground bits stay at the repo root for this commit: `index.html`, `src/index.ts`, `src/test-commands.json`, `src/commands.json`, `src/commands-schema.json` (the schema relocates to the codec in 3.E), and a slimmed root `vite.config.js` that handles only the dev/app build with the same shim aliases.
- Wire the playground (still at root) to consume the workspace lib: in root `package.json`, add `"@dgtlntv/protostar": "workspace:*"`. In `src/index.ts`, change `import { Protostar } from "./Protostar.js"` to `import { Protostar } from "@dgtlntv/protostar"`.
- Root `package.json` orchestration scripts: `dev` runs root Vite, `build:lib` runs `pnpm --filter @dgtlntv/protostar build:lib`, `test:unit` runs `pnpm -r test:unit`, etc.

**Exit criteria:** `pnpm --filter @dgtlntv/protostar build:lib` produces `packages/protostar/dist/index.es.js` and `index.umd.js`. Root playground (`pnpm dev`) imports the lib via workspace and runs identically to before. E2E suite green. Per-package unit tests green via `pnpm -r test:unit`.
**Commit:** `refactor: extract @dgtlntv/protostar into packages/protostar`

## Sub-phase 3.C — Extract `playground` package

Moves the playground out of the repo root into its own private workspace package. After this commit, the repo root is purely workspace orchestration — no app source, no `index.html`.

- Create `packages/playground/` with:
  - `package.json` — `name: "@dgtlntv/playground"`, `private: true`, depends on `"@dgtlntv/protostar": "workspace:*"`.
  - `tsconfig.json` extending the base config.
  - `vite.config.ts` — the dev/app build, with shim aliases (still required here because the playground bundles the lib's source through Vite during dev, before the lib's own bundle exists; 3.D removes the need for these aliases on the playground side).
  - `playwright.config.ts` — moved from repo root, paths adjusted to point at `packages/playground/dist` for the preview server.
- Move source files:
  - `index.html` → `packages/playground/index.html`.
  - `src/index.ts` → `packages/playground/src/main.ts` (renamed for clarity — it is no longer a dual entry).
  - `src/test-commands.json`, `src/commands.json` → `packages/playground/src/`. (`commands-schema.json` stays at the old path for one more commit; 3.E moves it into the codec.)
- Move e2e tests: `tests/e2e/` → `packages/playground/tests/e2e/`. Update any import paths.
- Update CI workflows:
  - `.github/workflows/test.yml`: `pnpm --filter @dgtlntv/playground test:e2e`.
  - `.github/workflows/deploy.yml`: `pnpm --filter @dgtlntv/playground build`, artifact path `packages/playground/dist`. The `BASE_PATH: ${{ github.event.repository.name }}` env var passes through unchanged — `packages/playground/vite.config.ts` reads it the same way.
- Root `package.json` shrinks to a workspace root: orchestration scripts only, no `dependencies`, no `devDependencies` beyond `pnpm` itself if anything.
- Update `.claude/architecture.md` "Entry Points" and "File Layout" sections to reflect the new package paths.

**Exit criteria:** `pnpm dev` from root spins up the playground from `packages/playground/`. E2E suite green from its new location. Pages workflow produces a working artifact (verify via `workflow_dispatch` on a feature branch before merge). Repo root contains no application source.
**Commit:** `refactor: extract playground into packages/playground`

## Sub-phase 3.D — Bake shims into the published lib build

Moves `packages/protostar/`'s lib build from "externalize deps and let the consumer figure out the shims" to "bundle deps so the published artifact is self-contained." After this commit, a Vite/webpack/Next.js consumer can `npm install @dgtlntv/protostar` and use it without writing a single shim alias of their own.

- In `packages/protostar/vite.config.ts`, configure `build.rollupOptions.external = []` explicitly. The empty array states intent: a future tooling default that re-externalizes `dependencies` would silently resurrect the "you need these aliases in your Vite config" onboarding step we're deleting in this commit.
- The `resolve.alias` shims already in the same config now apply to those bundled deps' transitive imports (`node:module`, `node:events`, `node:path`, `node:perf_hooks`, `child_process`, `fs`, `os`, `path`, plus the unpkg URLs hardcoded in `yargs/browser`).
- Document the new bundle size in the commit message body.
- The playground in `packages/playground/` keeps its shim aliases — they're still needed during dev because Vite resolves `@dgtlntv/protostar` to the package's `src/` (workspace symlink), not its built `dist/`. The asymmetry is the conventional monorepo pattern (dev = src for HMR; consumer = dist post-publishConfig). Document it in `packages/playground/vite.config.ts` so a future reader doesn't try to remove the aliases.
- Update `README.md`: remove any prior "you need these shim aliases in your Vite config" instructions; replace with a single-line "drop in and use" install snippet.
- Update `.claude/architecture.md` "Entry Points" to reflect the bundled-deps lib build.

No automated build-smoke harness lands here. Considered, prototyped, dropped — see "Decisions deferred" below for the rationale. The same regression class (broken lib bundle when imported by a downstream Vite project) is covered by 3.J's post-publish manual smoke and by `pnpm publish --dry-run` once that step lands.

**Exit criteria:** lib unit tests green. E2E green (lib bundle isn't on the playground's load path during dev, but `pnpm build:lib` exits 0 and the playground's app build still works). Bundle size noted in commit body.
**Commit:** `build(lib): bundle shimmed deps so consumers work with no Vite config`

## Sub-phase 3.E — `@dgtlntv/protostar-codec` package

Adds the standalone codec that encodes a `Commands` config into a URL-safe hash payload and decodes it back out. No playground wiring yet — the codec is fully tested in isolation before anything depends on it.

- Create `packages/protostar-codec/` with:
  - `package.json` — `name: "@dgtlntv/protostar-codec"`, `version: "0.0.1"`, `type: "module"`, `bin: { "protostar-encode": "./dist/cli.js" }`. Runtime deps: `ajv`. Dev deps: `vitest`, `typescript`, the build tool (`vite` or `tsup`).
  - `tsconfig.json` extending base.
  - `schema/commands.schema.json` — moved from `packages/playground/src/commands-schema.json` (or wherever it ended up after 3.B; was originally `src/commands-schema.json`). The schema's runtime home is the codec from now on.
- Implement `packages/protostar-codec/src/`:
  - `compress.ts` — `compressDeflateRaw(input: string): Promise<Uint8Array>` and `decompressDeflateRaw(input: Uint8Array): Promise<string>` using `CompressionStream`/`DecompressionStream` (`"deflate-raw"` format). Works in Node 18+ and modern browsers.
  - `base64url.ts` — `bytesToBase64url(bytes: Uint8Array): string` and `base64urlToBytes(s: string): Uint8Array`. URL-safe alphabet (`-`/`_`), no padding. Implementation uses `btoa`/`atob` with the standard `+→-`, `/→_`, strip-`=` transforms (and the reverse on decode); both are available in Node 18+ and all browser targets.
  - `validate.ts` — AJV instance compiled at module load against the bundled schema. Exports `validateCommands(value: unknown): { ok: true; value: Commands } | { ok: false; error: string }`. The error message includes the AJV path and a one-line description.
  - `encode.ts` — `encode(commands: Commands): Promise<string>`:
    1. Validate against schema; throw on invalid input.
    2. `JSON.stringify(commands)` (sorted-key variant if cheap; otherwise plain — document the choice).
    3. Compress via `compressDeflateRaw`.
    4. Encode via `bytesToBase64url`.
    5. Return `"p1=" + payload`.
  - `decode.ts` — `decode(input: string): Promise<{ ok: true; commands: Commands } | { ok: false; error: string }>`:
    1. Strip leading `#` if present.
    2. Parse `key=value`. If `key !== "p1"`, return `{ ok: false, error: "unsupported encoding version: <key>" }`. The versioned key lets us swap compression or alphabet later without breaking old links.
    3. Base64url-decode → decompress → `JSON.parse` → validate. Wrap each step's failure in a clear error string.
  - `index.ts` — re-exports `encode`, `decode`, `validateCommands`, plus the `Commands` type re-imported from `@dgtlntv/protostar`.
  - `cli.ts` — Node CLI: reads JSON from stdin, calls `encode`, writes `https://<host>#p1=...` to stdout. `--host <url>` flag overrides the default; default is the GitHub Pages playground host (`https://dgtlntv.github.io/protostar/`) so the no-flags output is a working share URL. `--no-host` writes only the fragment. Exit code non-zero on validation failure with the AJV error on stderr.
  - Bundles the schema JSON inline at build time (Vite/tsup `assetsInlineLimit` or explicit JSON import) so consumers don't need a separate schema file.
- Unit tests under `packages/protostar-codec/tests/`:
  - `roundtrip.spec.ts` — encode then decode for the bundled `test-commands.json`, assert deep equality. Same for `commands.json`.
  - `base64url.spec.ts` — encodes that exercise `+`/`/` substitutions and missing padding edge cases.
  - `compress.spec.ts` — verifies CompressionStream produces a known-stable byte sequence for a fixed input (lock the format so future changes are deliberate).
  - `validate.spec.ts` — schema-rejects malformed input (missing `commands`, wrong type for `welcome`, unknown `component` value) with informative error strings.
  - `decode-versioning.spec.ts` — `p2=...` returns `{ ok: false, error: /unsupported encoding version/ }`.
  - `cli.spec.ts` — spawn the built CLI, pipe JSON in, assert URL out and round-trip via `decode`.
- Add a `pnpm --filter @dgtlntv/protostar-codec build` step to CI before tests so the smoke and CLI specs run against the built artifact.

**Exit criteria:** all codec specs green. CLI runs in Node 18+ and produces a URL whose payload `decode` round-trips to the original input. Encoder rejects schema-invalid input with a useful message. Bundle ships the schema inline. Package is publishable in shape (verified by `pnpm publish --dry-run`); actual publish lands in 3.J.
**Commit:** `feat(codec): add @dgtlntv/protostar-codec for URL encode/decode`

## Sub-phase 3.F — Wire URL loader into playground

Lands the user-visible feature. The playground reads the URL hash on boot, decodes via the codec, and either runs the decoded prototype or falls back to the bundled demo with a clearly rendered error.

- Add `"@dgtlntv/protostar-codec": "workspace:*"` to `packages/playground/package.json`.
- In `packages/playground/src/main.ts`:
  - Read `location.hash`. If non-empty, `await decode(hash)`. On `ok: true`, instantiate `Protostar` with the decoded commands and skip the bundled JSON entirely.
  - On `ok: false` (malformed payload, decompression error, schema rejection, unsupported version): render a single-line error in the terminal area before booting the playground with the bundled JSON. The error mentions which step failed and includes a link/instruction to fix the URL. Do not silently fall back — silent failure on a shared link is the worst UX.
  - On no-hash: bundled JSON, current behavior, unchanged.
- The bundled `Protostar` instance is unchanged — only the data source changes.
- Add a "Copy share link" affordance:
  - Keyboard shortcut (e.g., `Ctrl+Shift+L`) that calls `encode(currentCommands)` and writes the resulting URL (`location.origin + location.pathname + "#" + payload`) to the clipboard via `navigator.clipboard.writeText`.
  - Renders a one-line confirmation in the terminal area on success, an error line on clipboard rejection.
  - Only useful when the playground is showing the bundled demo and the author wants to share the *current* state — for prototypes that came in via URL, the existing URL already works. Document this in the README.
- E2E specs added to `packages/playground/tests/e2e/`:
  - `url-loader.no-hash.spec.ts` — no hash → bundled JSON loads (regression coverage).
  - `url-loader.valid-hash.spec.ts` — Playwright generates a known-good hash via the codec helper, navigates, asserts the prototype matches the input.
  - `url-loader.invalid-hash.spec.ts` — malformed payload → error rendered + bundled fallback runs.
  - `url-loader.bad-schema.spec.ts` — well-formed encoding of schema-invalid JSON → schema error rendered.
  - `share-link.spec.ts` — keyboard shortcut populates the clipboard with a URL whose payload decodes back to the bundled commands.
- Update `README.md` with:
  - The URL-sharing feature, with a short example.
  - The "Copy share link" shortcut.
  - Note that the URL is hash-based, never sent to the server, so prototypes stay client-side.
- Update `.claude/architecture.md` "Entry Points" with the new boot path (hash decode → fallback).

**Exit criteria:** all five new e2e specs green. Existing e2e green. `pnpm dev` boots the playground identically when no hash is present and runs a decoded prototype when a `#p1=...` hash is in the URL. Manual verification of the deployed Pages site after merge.
**Commit:** `feat(playground): load commands from base64url URL hash`

## Sub-phase 3.G — Security hardening

Adds the hardening that makes the URL loader safe to ship publicly. Three mitigations land together: a decompressed-size cap in the codec, an encoder-side size check so authors hit a clear error before shipping a too-large prototype, and a friendly banner in the playground that frames URL-loaded prototypes as mock environments. Nothing here changes the feature surface — it constrains it.

The cap is set at **256 KiB (262144 bytes)**. Realistic prototype JSON is in the 4–7 KB range (current bundled demos), so 256 KiB sits ~30–50× above real use while bounding worst-case parse + AJV-validate workload to a few tens of milliseconds. Sized as a security ceiling, not a UX ceiling — practical "shareable URL" failure (chat apps, email previewers) hits 10–100× sooner than the cap.

### Codec: 256 KiB decompressed-size cap (`decode`)

- `decompressDeflateRaw` switches from "decompress all, then return" to a streaming pipeline that counts emitted bytes. As soon as cumulative output crosses 256 KiB, the stream is aborted and the function returns `{ ok: false, error: "decompress: decompressed payload exceeds size limit of 262144 bytes" }`.
- Implementation: a `TransformStream` between `DecompressionStream` and the consumer. Counts bytes per chunk and aborts the moment a chunk would push the running total past the cap. The full payload is never held in memory; pathological inputs fail fast.
- Cap value lives in one place as `MAX_DECOMPRESSED_BYTES = 262_144` so future tuning is a single edit.

### Codec: encoder size check (`encode`)

- Before compressing, `encode` measures `JSON.stringify(commands).byteLength` (UTF-8 bytes via `TextEncoder`, not `String.length`).
- If it exceeds 256 KiB, throw with a message that explains why: `"Prototype is X.X KB raw JSON; the maximum supported size is 256 KB. The decoder rejects payloads that decompress beyond this limit, so a URL produced from this input would not load on the receiver."`
- The check runs after schema validation — a malformed prototype is a more useful error than a size error, so we surface that first.
- CLI surfaces the message to stderr and exits non-zero. Programmatic callers (agent skill, share button) get a rejected promise with the same message and can present it in their own UI.

### Playground: "this is a prototype" banner

When the playground boots from a URL hash (success or failure), a single-line notice sits above the terminal:

> This is a prototype, not a real terminal. Don't enter real credentials.

- Tone: informational, not alarming. No red, no warning iconography, no scary modal. Slim bar, lower-contrast text, blends with the chrome.
- Banner DOM is owned by the playground, outside the xterm host element — prototype content cannot cover, restyle, or remove it.
- Shown only on URL-hash boots. The bundled-demo path (no hash) is trusted local content; no banner there.
- Small "dismiss" affordance at the right end collapses the banner to a tiny icon for the rest of the tab session (`sessionStorage`, not `localStorage` — a fresh tab always shows the full banner). Discoverable for repeat users, not nagging.

### Mitigations explicitly NOT in scope

Decisions captured here so they don't drift back in by accident:

- **No xterm.js feature lockdown** (OSC 8 hyperlinks, OSC 52 clipboard, OSC 0/1/2 window title) for URL-loaded prototypes. The banner is the user-facing trust boundary; locking down terminal features beyond that fights the prototyping use case.
- **No `{{var}}` interpolation sanitization.** Same rationale — the banner sets expectations; over-constraining the feature surface to defend against contrived phishing chains is not worth the cost in real-world expressiveness.
- **No schema bounds (`maxLength`, `maxItems`, `maxProperties`).** The 256 KiB decompressed cap bounds total parser/validator workload; per-field bounds add maintenance friction without meaningful additional protection.

### Testing

- Codec unit tests:
  - `decode.size-limit.spec.ts` — constructs a payload by compressing 1.5× the cap of repeated bytes (a few KB compressed). Asserts `decode` returns the size-limit error in well under 100 ms. We construct the input ourselves; nothing exploit-grade is in the repo.
  - `encode.size-limit.spec.ts` — calls `encode` with a synthetic over-cap `Commands` value. Asserts the function throws with the documented message.
- Playground e2e: `url-loader.banner.spec.ts` — boots with a valid hash, asserts the banner is present and renders the expected text; boots without a hash, asserts no banner; boots with a malformed hash, asserts the banner is still present (it's a property of the boot mode, not of decode success).

**Exit criteria:** size-limit specs green and fast (<100 ms each). Banner shows on URL-hash boots, hidden on bundled-demo boots, persists across prototype renders, dismiss-collapse stays collapsed within the tab session and resets in a new tab. Existing e2e green.
**Commit:** `feat(security): cap decoded size, warn on oversized encode, banner URL-loaded prototypes`

## Sub-phase 3.H — Workspace orchestration: scripts + linting

Polishes the developer experience now that all packages exist and the URL feature has landed. Ad-hoc scripts added during 3.A–3.F get standardized; linting is added repo-wide so subsequent work has a consistent code-quality gate. This is the last sub-phase before the docs sweep — by the time it ends, `pnpm ci` from the root runs the full check matrix locally with the same commands CI runs.

### Standardize per-package scripts

Every package exposes the same script names so root-level orchestration via `pnpm -r <script>` works uniformly. Packages that legitimately don't have a given script just don't define it (pnpm's `-r` skips them silently).

| Script | Where it runs | What it does |
|---|---|---|
| `typecheck` | every package | `tsc --noEmit -p tsconfig.json` |
| `test:unit` | protostar, protostar-codec | `vitest run` |
| `test:e2e` | playground | `playwright test` |
| `build` | protostar (lib build), codec, playground (app build) | `vite build` (with mode where applicable) |
| `dev` | playground | `vite` |
| `lint` | every package | `eslint .` |
| `lint:fix` | every package | `eslint . --fix` |

### Root orchestration scripts

Root `package.json` becomes a thin façade — every command delegates to per-package scripts:

```json
"scripts": {
  "dev": "pnpm --filter @dgtlntv/playground dev",
  "build": "pnpm -r build",
  "build:lib": "pnpm --filter @dgtlntv/protostar build",
  "test": "pnpm test:unit && pnpm test:e2e",
  "test:unit": "pnpm -r test:unit",
  "test:e2e": "pnpm --filter @dgtlntv/playground test:e2e",
  "typecheck": "pnpm -r typecheck",
  "lint": "pnpm -r lint",
  "lint:fix": "pnpm -r lint:fix",
  "ci": "pnpm typecheck && pnpm lint && pnpm test"
}
```

The `ci` script is what `.github/workflows/test.yml` invokes (or rather, the CI runs the same individual steps so failures attribute correctly — but local `pnpm ci` is the "did I break something?" check before pushing).

### Linting setup

- ESLint 9 with flat config at repo root: `eslint.config.js`. One config file shared across packages — per-package configs aren't justified at this scale.
- Plugins: `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`. Rule set: typescript-eslint's `recommended-type-checked`. No opinionated stylistic rules — formatting is out of scope (see deferred decisions).
- Targets: `packages/**/src/**/*.ts`, `packages/**/tests/**/*.ts`. Excludes `dist/`, `node_modules/`, build artifacts.
- Each package's `lint` script just runs `eslint .` and inherits the root config.
- ESLint and its plugins live as devDependencies at the repo root (single instance, shared via the workspace's hoisted `node_modules`).
- First-pass lint will surface real issues on the existing tree. Fix them in this same commit. Suppress only with explicit `// eslint-disable-next-line <rule>` comments and only where the rule is genuinely wrong for that line — never blanket-disable a rule across a file.

### CI changes

`.github/workflows/test.yml` runs the steps explicitly so failures attribute:

```yaml
- run: pnpm install --frozen-lockfile
- run: pnpm typecheck
- run: pnpm lint
- run: pnpm test:unit
- run: pnpm test:e2e
```

`deploy.yml` is unchanged from 3.C — it builds and uploads, doesn't run the full check matrix.

### Decisions deferred

- **Prettier.** Adding it is straightforward but introduces formatting churn across the existing tree on first run. Out of scope unless the user opts in.
- **Husky / lint-staged pre-commit hooks.** CI catches lint failures; pre-commit hooks add friction. Skip until there's a reason.
- **Stricter rules** (e.g., `no-floating-promises`, exhaustive-deps style rules). Start with the recommended set; tighten as we find rules we want.

**Exit criteria:** `pnpm ci` passes locally on a clean checkout. Every package responds to `typecheck`, `lint`, and (where applicable) `test:unit` / `test:e2e`. ESLint reports 0 problems on the tree. CI workflow runs the same five commands.
**Commit:** `chore: standardize workspace scripts and add ESLint`

## Sub-phase 3.I — Docs + cleanup

Sweeps docs to match the new reality and closes any deferred items from earlier sub-phases.

- `README.md` — install (`pnpm install`), package layout, library consumption (no shims), playground dev (`pnpm dev`), URL-sharing, codec API surface and CLI usage. Top-of-file table of contents if length warrants.
- `.claude/architecture.md` — add a "Workspace layout" section listing the three packages and their responsibilities; update "Entry Points" and "File Layout" tables to use the new paths; note the codec → playground → lib dependency direction.
- Add `CONTRIBUTING.md` (or extend README) covering:
  - How to add a new package to the workspace.
  - The standard script names every package exposes (`typecheck`, `lint`, `test:unit`, etc.) — so a new package fits the orchestration without retrofitting.
  - How to run each test suite (`pnpm --filter <pkg> test:unit`, `pnpm test:e2e`).
  - The release flow (placeholder, populated in 3.J).
  - The "no `npm` invocations" rule.
  - The shim asymmetry between the lib build (deps bundled) and the playground dev build (deps not bundled, shim aliases needed).
- Update `.claude/known-bugs.md` if any bug surfaced during the migration. None expected — this phase doesn't touch behavior — but check.
- Verify `package.json` `repository` fields point at the right paths now that source has moved.

**Exit criteria:** docs match the layout. Branch green. No `npm` references remain in tracked files (sanity check via `git grep -n "npm " | grep -v lock` and similar).
**Commit:** `docs: refresh for monorepo layout and URL-sharing feature`

## Sub-phase 3.J — Publish to npm

First real release of both `@dgtlntv/protostar` and `@dgtlntv/protostar-codec`. The lib has been publishable in shape since pre-Phase 3 but never actually shipped; the codec is new in 3.E. Both go up at `0.1.0` — first usable release, still pre-1.0 — so semver communicates "expect breaking changes" without the "wholly unstable, don't look" signal of `0.0.x`.

### Per-package publishing metadata

In each package's `package.json`:

- `@dgtlntv/protostar`:
  - Confirm `description`, `keywords`, `repository`, `author`, `license`, `exports`, `main`, `module`.
  - `files: ["dist", "README.md", "LICENSE.md"]` — explicit allowlist, no `.npmignore` to maintain.
  - `"publishConfig": { "access": "public" }` — required for scoped packages on the public registry.
  - `"prepublishOnly": "pnpm build"` — guarantees the published bundle matches the committed source.
- `@dgtlntv/protostar-codec`:
  - Same metadata fields, including the `bin` entry from 3.E (`"protostar-encode": "./dist/cli.js"`).
  - `publishConfig.access: "public"`, same `prepublishOnly`.
  - Each package gets its own `README.md` (lib already has one — extracted to `packages/protostar/README.md` in 3.B; codec README written in 3.E with API surface and CLI usage examples).

### Versioning

Both packages: `0.0.1` → `0.1.0`. Single commit covers both bumps. We're not running changesets yet — for two packages with low churn, manual version bumps are fine. The decision to add changesets is deferred (see below).

### Root release script

```json
"scripts": {
  "release:dry-run": "pnpm -r publish --dry-run",
  "release": "pnpm -r publish --access public --no-git-checks"
}
```

`--no-git-checks` because pnpm's default git checks are aimed at single-package repos (current branch matches `publishBranch`, working tree clean for the package being published). The workspace publishes both packages from one commit, so the checks misfire. Discipline replaces the safety net: never publish from a dirty tree, never publish off `main`.

CI runs `pnpm release:dry-run` on every PR that touches `packages/*/package.json`, `packages/*/src/**`, or `packages/*/dist/**`. Catches "the publishable artifact is malformed" before tag time.

### Release flow (documented in `CONTRIBUTING.md`)

1. Verify `pnpm ci` is green on `main`.
2. Bump versions in both `packages/*/package.json`.
3. Commit: `release: vX.Y.Z`.
4. Push, wait for CI green.
5. `pnpm release` from the workspace root. (Requires `pnpm login` to npm with publish rights on the `@dgtlntv` scope.)
6. Tag: `git tag protostar-vX.Y.Z codec-vX.Y.Z`. Push tags.
7. Manual post-publish smoke (first release only, then trust CI's build-smoke):
   - In a tmp dir: `npm init -y && npm install @dgtlntv/protostar @dgtlntv/protostar-codec`. Tiny script that imports both, instantiates the lib, calls `encode`/`decode` on the codec. Confirm no errors.
   - Confirm the README install snippet works as written when copy-pasted into a fresh Vite project.

### Decisions deferred

- **Automated release on git tag.** A `.github/workflows/release.yml` that fires on `v*` tags and runs `pnpm release` is the next ergonomic step. Adds NPM_TOKEN handling, GitHub OIDC setup if we want provenance attestations. Land manually first; automate once the flow has a few releases under its belt.
- **Changesets / release-please.** Useful once releases are frequent enough that hand-bumping is tedious. Two packages with low churn don't justify the tooling yet.
- **`--provenance`.** Requires the automated-release workflow above (OIDC). Worth turning on then, not now.

**Exit criteria:** both packages installable via `npm install @dgtlntv/protostar` and `npm install @dgtlntv/protostar-codec` from a fresh, workspace-free directory. Manual smoke-import works. Tags pushed. README install snippet validated against a fresh Vite project.
**Commit:** `release: publish @dgtlntv/protostar and @dgtlntv/protostar-codec v0.1.0`

## Open questions / decisions deferred

- **AJV runtime vs compiled-standalone.** Phase 3 ships runtime AJV (~30 KB gzipped in the codec bundle). If bundle size becomes a concern after measurement, switch to `ajv-cli`-generated standalone validators in a follow-up. Don't optimize speculatively.
- **JSON.stringify key ordering in the codec.** Fixed key ordering would make encoded URLs stable across runs of the same input (nice for diffing, caching). Plain `JSON.stringify` is simpler and the encoded payload is opaque anyway. Default to plain unless we hit a use case for stable ordering.
- **Lib bundle size after baking shims (3.D).** Estimated 200–400 KB minified self-contained. If real-world numbers come in significantly worse, revisit which deps are bundled vs externalized — a `peerDependencies` model for `@xterm/xterm` (consumers usually want their own copy of xterm) could be the right call later. Don't preempt; measure first.
- **"Copy share link" UX in 3.F.** Keyboard shortcut is the minimum viable affordance. A visible button or a `/share` slash command in the prototype is a follow-up if the shortcut feels too hidden.
- **Prettier.** Out of scope for 3.H; revisit once the lint baseline is established.
- **Automated release workflow.** Deferred from 3.J; manual publish first.
- **Automated build-smoke harness.** Considered for 3.D, prototyped, dropped. Rationale: (1) playground already exercises the same source paths through Vite with the same shim aliases; (2) post-publish manual smoke in 3.J covers the "downstream `npm install` works" regression at the right granularity; (3) the harness setup is fragile under pnpm 11's strict build-script approval. Revisit if a real downstream consumer reports the bundle doesn't import.

## Rough sizing

| Sub-phase | Net new (LOC) | Net deleted (LOC) | Notes |
|---|---|---|---|
| 3.A | ~30 | ~50 | pnpm-workspace, tsconfig.base, CI tweaks; package-lock removal dominates deletes |
| 3.B | ~80 | ~20 | New package.json, tsconfig, vite.config; mostly file moves |
| 3.C | ~80 | ~30 | Same as 3.B for the playground; CI artifact-path edits |
| 3.D | ~15 | ~5 | Vite config: explicit `external: []`, comment update; README + architecture.md updates |
| 3.E | ~700 | ~10 | Six modules + six spec files + CLI + schema relocation |
| 3.F | ~250 | 0 | URL-loader wire-up + share shortcut + five e2e specs |
| 3.G | ~120 | ~10 | Streaming size cap in `decode`, encoder size check, banner DOM + dismiss, three new specs |
| 3.H | ~120 | ~30 | ESLint config, root scripts, per-package script normalization, fixes for first-pass lint findings |
| 3.I | ~150 | ~50 | Doc sweep, CONTRIBUTING, dead-link cleanup |
| 3.J | ~30 | 0 | publishConfig fields, release scripts, version bumps |

End state: three workspace packages (`protostar`, `protostar-codec`, `playground`), pnpm everywhere, library consumable with zero shim setup downstream, and a URL-shareable playground backed by a published-ready codec. Existing e2e + unit suites unchanged in shape; new specs land alongside the codec and the URL loader. No behavior regressions in the playground; new behavior gated on the presence of a `#p1=` hash.
