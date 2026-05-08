# Phase 3 Testing Strategy

Phase 3 keeps the same two test layers Phase 2 established (e2e + Vitest unit) and extends both to cover the new packages. An automated build-smoke layer was scoped, prototyped, and dropped — see "Why no build-smoke" below. Each remaining layer catches a class of break the other misses.

| Layer | Catches | Runs |
|---|---|---|
| Vitest unit (per package) | Pure-function correctness in lib + codec; component rendering against a virtual terminal | `pnpm -r test:unit` |
| Playwright e2e (playground) | DOM bootstrap, hash reading, error rendering, clipboard, full integration through xterm | `pnpm --filter @dgtlntv/playground test:e2e` |

CI runs unit before e2e so a fast layer fails fast.

## Layer 1 — Vitest unit (extends Phase 2)

### Library package (`packages/protostar/tests/unit/`)

Phase 2's existing unit suite moves with the library source in 3.B. **No spec content changes.** The only edits are:

- Helper imports: `tests/unit/helpers/virtualTerm.ts` paths if they reach into `src/` relatively.
- `vitest.config.ts` moves into the package; glob remains `tests/unit/**/*.spec.ts`.

Coverage continuity contract for 3.B: every Phase 2 unit spec that passed before the move passes after. Run `pnpm --filter @dgtlntv/protostar test:unit` against the old and new layout, diff the spec list, confirm parity.

### Codec package (`packages/protostar-codec/tests/`)

New in 3.E. Six spec files cover each codec module plus the CLI. Each is the exit criterion for 3.E — the sub-phase is not green unless every list below passes.

#### `roundtrip.spec.ts`

- Round-trip `test-commands.json` (the playground's bundled demo): `decode(encode(commands))` deep-equals `commands`.
- Round-trip `commands.json` (the user-facing example).
- Round-trip a synthetic minimal `Commands` with one command and one option.
- Round-trip a synthetic large `Commands` (hundreds of commands) — confirms compression actually compresses (encoded size < raw JSON size by >2x for representative input).
- Encoded payload fits in <2000 chars for the bundled demo (current realistic URL-bar limit). Documented as a soft assertion — fails loud if a future schema change blows past it.

#### `compress.spec.ts`

- `decompressDeflateRaw(compressDeflateRaw(s))` returns `s` for ASCII, multibyte UTF-8, and binary-safe edge cases (null bytes inside the JSON).
- For a fixed input string, the compressed bytes match a known-stable hex sequence. **Lock the format** so future changes to the compression pipeline are deliberate, not accidental — accidental format drift breaks every previously-shared URL.
- `decompressDeflateRaw` rejects clearly-corrupted input with a typed error.

#### `base64url.spec.ts`

- `bytesToBase64url(base64urlToBytes(s))` returns `s` for inputs covering: empty, single byte, lengths that exercise each padding case (n%3 = 0/1/2).
- Output contains no `+`, `/`, or `=` characters.
- Decoding tolerates strings with or without padding (lenient input, strict output).
- Decoding rejects non-alphabet characters.

#### `validate.spec.ts`

- Accepts the bundled `test-commands.json` and `commands.json`.
- Rejects: missing `commands` field, `welcome` set to a number, `commands.foo.handler.component` set to an unknown discriminant value, `variables` whose values are not strings.
- Rejection error includes the AJV path (e.g., `/commands/foo/handler/component`) and a one-line description.
- AJV instance compiles once at module load (assert via mocked timer or compile-counter) — recompiling per validation would be a perf regression.

#### `decode-versioning.spec.ts`

- `decode("p1=<valid-payload>")` returns `{ ok: true, ... }`.
- `decode("#p1=<valid-payload>")` strips the leading `#` and returns `{ ok: true, ... }`.
- `decode("p2=anything")` returns `{ ok: false, error: /unsupported encoding version/ }`.
- `decode("p1=<garbage>")` returns `{ ok: false, error: /<step>/ }` where `<step>` identifies which pipeline stage failed (base64, decompress, parse, validate). The error message is the user-facing diagnostic, so its content matters.
- `decode("")` and `decode("#")` return a clear error, not a crash.

#### `cli.spec.ts`

- Spawn the built CLI: pipe `test-commands.json` to stdin, assert stdout is `https://dgtlntv.github.io/protostar/#p1=<base64url>`, exit 0.
- Spawn with `--host https://my.site/path`: stdout is `https://my.site/path#p1=<base64url>`.
- Spawn with `--no-host`: stdout is `p1=<base64url>` (no scheme/host, just the fragment payload).
- Spawn with schema-invalid input: exit code non-zero, AJV error path on stderr, stdout empty.
- Round-trip: pipe the CLI's stdout (`#p1=...` portion) into `decode`, assert deep equality with the original input.

## Why no build-smoke

The class of break a build-smoke layer would catch is "the published `@dgtlntv/protostar` bundle is broken when imported by a real downstream Vite/webpack project" — for example, a pi-tui transitive import that escapes the shim aliases at lib-build time and surfaces as an unresolved external in the consumer's build. We considered an automated smoke harness (tiny Vite project + tarball install + consumer build) and dropped it for three reasons:

1. **The playground covers most of the same surface.** The playground bundles the lib's source through its own Vite resolver with the same shim aliases. A new Node-only transitive import would break the playground's app build before it broke a downstream project.
2. **Post-publish manual smoke (in 3.J) is the canonical first-release sanity check** and catches anything the playground misses. The cost is one fresh `npm install` in a tmp dir per release — cheap, infrequent, high signal.
3. **The setup is fragile.** pnpm 11's strict build-script approval, tarball naming + lifecycle, and `--ignore-workspace` interactions make the harness easy to break for reasons orthogonal to the lib. Maintenance cost > value at this scale.

If a real downstream consumer ever reports "your published bundle doesn't import," that's the trigger to revisit. Until then, the layered approach (unit → e2e → manual release smoke) is the right cost/coverage balance.

## Layer 2 — Playwright e2e (extends Phase 2)

### Continuity contract for 3.B / 3.C

Every Phase 1/2 e2e spec passes at every commit boundary. Most at risk:

- **3.B (lib extraction):** `tests/e2e/helpers/types.ts` and `helpers/terminal.ts` may need import-path adjustments if they reach into `src/` for type imports. Spec content unchanged.
- **3.C (playground extraction):** the entire `tests/e2e/` tree moves to `packages/playground/tests/e2e/`. `playwright.config.ts` moves with it; the `webServer` block updates to point at the playground's preview server. Spec content unchanged.

If a path adjustment forces a spec file to change shape (not just import paths), that's a flag to stop and reconsider — Phase 3 should not be touching test semantics.

### New specs in 3.F

Five new specs land in `packages/playground/tests/e2e/url-loader/` (or however the existing tree is organized). Each is an exit criterion for 3.F.

#### `url-loader.no-hash.spec.ts`

- Navigate to the playground with no hash.
- Assert the welcome banner from the bundled `test-commands.json` renders.
- Regression coverage — proves the no-hash path is unchanged.

#### `url-loader.valid-hash.spec.ts`

- Use the codec helper (imported from `@dgtlntv/protostar-codec` directly in the test process — same package, no fixture file drift) to encode a synthetic minimal `Commands`.
- Navigate to `playground/#p1=<encoded>`.
- Assert the synthetic welcome banner renders, not the bundled one.
- Run a known command from the synthetic config, assert its output.
- This is the integration test for the full encode-in-Node → decode-in-browser pipeline.

#### `url-loader.invalid-hash.spec.ts`

- Navigate to `playground/#p1=garbage`.
- Assert a clearly-rendered error line in the terminal area.
- Assert the bundled `test-commands.json` welcome banner renders below the error (fallback runs).
- Assert the playground is interactive after the fallback — the error doesn't break the prompt.

#### `url-loader.bad-schema.spec.ts`

- Use the codec's `compress` + `base64url` directly (skip `validate`) to produce a hash whose payload is well-formed JSON but schema-invalid (e.g., `{"commands": "not an object"}`).
- Navigate to that hash.
- Assert the rendered error names the schema field that failed (the user has to know what to fix).
- Assert fallback to bundled JSON.

#### `share-link.spec.ts`

- Boot the playground with no hash (bundled JSON).
- Trigger the share keyboard shortcut.
- Assert clipboard content matches `^https?://.+/#p1=[A-Za-z0-9_-]+$`.
- Decode the clipboard content via the codec (same in-test helper as `url-loader.valid-hash.spec.ts`); assert it deep-equals the bundled `test-commands.json`.
- Closes the round-trip loop: the share button produces a URL that the playground knows how to decode.

### Browser matrix

Playwright's default Chromium-only matrix is sufficient for Phase 3. `CompressionStream` / `DecompressionStream` are supported in current Firefox and Safari, but cross-browser e2e is a separate axis we're not opening up here. If a real CompressionStream behavior diff surfaces, that's the trigger.

## Cross-cutting concerns

### Test ordering in CI

```
pnpm install --frozen-lockfile
pnpm -r test:unit                                        # fast — all packages
pnpm --filter @dgtlntv/playground build                  # gate for e2e
pnpm --filter @dgtlntv/playground test:e2e               # slow
```

Each step is a separate CI job step so failures attribute correctly. If `test:unit` is slow enough on the codec package to matter, parallelize with a Vitest projects config in a follow-up — not Phase 3.

### Encoded-format stability

The codec emits a stable wire format: `p1=<base64url(deflateRaw(JSON.stringify(commands)))>`. Two specs anchor this:

- `compress.spec.ts` locks the `deflateRaw` byte sequence for a fixed input.
- `roundtrip.spec.ts` locks one encoded payload for `test-commands.json` against a stored fixture string. If `test-commands.json` changes, the fixture is regenerated in the same commit — but a code-only change that changes the encoded output without the fixture regenerating is a red flag.

This catches accidental format drift. Deliberate drift bumps `p1` to `p2`.

### Schema parity

`commands-schema.json` lives in `packages/protostar-codec/schema/`. The TypeScript `Commands` type lives in `packages/protostar/src/types/commands.ts`. Keeping the two in sync is a pre-existing concern (true in Phase 2 too). Phase 3 does not solve it; both remain authored by hand.

If schema/type drift becomes painful, a follow-up could generate the type from the schema via `json-schema-to-typescript`. Out of scope for Phase 3.

### Security specs (3.G)

Three new specs cover the security mitigations:

- `decode.size-limit.spec.ts` (codec unit) — constructs a payload by compressing 1.5 MB of repeated bytes (a few KB compressed, very large decompressed). Asserts `decode` returns `{ ok: false, error: /size limit/ }` in well under 100 ms. The streaming size check aborts at 1 MB+ε, so the test never holds a real megabyte of data in memory and runs quickly.
- `encode.size-limit.spec.ts` (codec unit) — calls `encode` with a synthetic >1 MB `Commands` value (programmatically generated, not loaded from a fixture file). Asserts the function throws with the documented oversized-prototype message.
- `url-loader.banner.spec.ts` (playground e2e) — three cases: hash-with-valid-payload boots show the banner; no-hash boots don't; hash-with-malformed-payload boots still show the banner (it's a property of the boot mode, not of decode success). Also verifies the dismiss-collapse interaction round-trips through `sessionStorage`.

The size-limit tests do not contain or run anything exploit-grade — both inputs are constructed programmatically by the test, with our own code on both sides of the boundary. There's no risk to CI or to a developer running `pnpm test:unit` locally.

### Lint as a CI gate (3.H onward)

ESLint isn't strictly a "test layer" in the same sense as unit/smoke/e2e — it doesn't verify behavior, it verifies code quality. But once 3.H lands, lint failures break CI, so it functions as a gate:

- `pnpm lint` runs `pnpm -r lint`, which runs ESLint per package against the shared root config.
- CI step `pnpm lint` runs after `pnpm typecheck` and before any test layer. Cheap, fails fast.
- New code must lint cleanly. Suppress only with `// eslint-disable-next-line <rule>` + a one-line comment explaining why; never blanket-disable a rule across a file.

If a lint rule turns out to be wrong for our codebase often enough that suppressions accumulate, the rule itself gets relaxed in `eslint.config.js` — not papered over with disable comments.

### Release-time validation (3.J)

Two checks gate a release, layered:

1. **Pre-tag (CI on PRs touching publishable surfaces):** `pnpm release:dry-run` runs `pnpm -r publish --dry-run` and validates that:
   - Each package's `package.json` has all required fields (`name`, `version`, `exports`/`main`/`module`, `files`, `publishConfig`).
   - The `files` allowlist actually resolves to the expected artifact (`dist/`, `README.md`, `LICENSE.md`).
   - The bundle compiles (via `prepublishOnly`).
   - No accidental leaks (e.g., source `.ts` files getting published).
   This catches the class of break "the publishable artifact is malformed" before tag time, where it's cheap to fix.

2. **Post-publish (manual, every release for now):** in a tmp directory outside the workspace, fresh `npm install @dgtlntv/protostar` and `npm install @dgtlntv/protostar-codec`. Tiny smoke script imports both, instantiates the lib, encodes/decodes through the codec. Catches the class of break "the registry has the artifact but it doesn't actually work when installed."

Without an automated build-smoke layer (see "Why no build-smoke" above), the post-publish step is our only end-to-end verification that a downstream consumer can actually `npm install` and run the lib. Keep it on every release until either (a) usage stabilizes enough that we're confident in the publish flow, or (b) we revisit automated smoke coverage.

### Test fixtures

- `test-commands.json` and `commands.json` live with the playground and double as test fixtures for codec round-trip specs. The codec imports them via `file:` workspace path inside its tests (`import demo from "@dgtlntv/playground/test-commands.json"` if exposed, else relative path).
- Synthetic minimal/large `Commands` values used in unit and e2e tests are co-located: `packages/protostar-codec/tests/fixtures/`. Any e2e spec that needs them imports the fixture file, not the codec internals.

## Per-sub-phase exit criteria summary

| Sub-phase | Test signals required to commit |
|---|---|
| 3.A | Existing `pnpm test:unit` and `pnpm test:e2e` pass exactly as before. |
| 3.B | Lib unit specs pass from `packages/protostar/tests/unit/`. E2E pass (paths only). |
| 3.C | E2E pass from `packages/playground/tests/e2e/`. CI artifact path verified via `workflow_dispatch`. |
| 3.D | `pnpm --filter @dgtlntv/protostar build:lib` produces a self-contained `dist/`. Lib unit + e2e green. Bundle size noted in commit body. |
| 3.E | All six codec spec files pass. CLI spawn test passes against the built binary. Format-stability fixture passes. `pnpm publish --dry-run` validates the publishable artifact. |
| 3.F | All five new playground e2e specs pass. Existing e2e green. Manual verification on Pages preview. |
| 3.G | Codec size-limit specs (`decode.size-limit.spec.ts`, `encode.size-limit.spec.ts`) green and fast (<100 ms each). Banner spec (`url-loader.banner.spec.ts`) green. Existing suites green. |
| 3.H | `pnpm ci` (typecheck + lint + unit + e2e) green from the workspace root. ESLint reports 0 problems on the existing tree. CI workflow runs the same five steps and matches local output. |
| 3.I | No new tests; existing suites unchanged. |
| 3.J | `pnpm release:dry-run` succeeds for both packages. Post-publish manual smoke (fresh `npm install @dgtlntv/protostar` and `@dgtlntv/protostar-codec` in a workspace-free tmp dir, import both, exercise basic API) passes. |

## Out of scope for Phase 3

- **Automated build-smoke layer.** Considered, prototyped, dropped — see "Why no build-smoke" above. The post-publish manual smoke in 3.J covers the same regression class.
- **Cross-browser CompressionStream coverage.** Playwright Chromium only.
- **Performance / bundle-size budgets enforced as CI gates.** 3.D's commit body documents the lib size; we don't fail CI on it. Add a budget if a regression actually happens.
- **Visual regression on the URL-loader error rendering.** Same reasoning as Phase 2: sub-frame transient rendering over-specifies.
- **Schema → type generation.** Pre-existing manual sync; Phase 3 doesn't change that.
- **Stress-testing very large prototypes.** The roundtrip spec's "synthetic large `Commands`" assertion is the upper bound we test; real-world authors with thousands of commands are not the target audience.

## Bug-fix verification matrix

Phase 3 is structural and doesn't touch behavior, so no Phase-1/2 fixmes flip and no new bugs are expected to surface. If something *does* break during the migration:

- The breaking commit is rolled back, not patched forward.
- The break gets a `known-bugs.md` entry **before** any forward fix.
- The fix lands as a new sub-phase commit with a verifying test, same way Phase 2 handled BUG-015/016/017.

The migration's success criterion is "every existing test that passed before phase 3 passes after." Anything else is a regression, not a feature.
