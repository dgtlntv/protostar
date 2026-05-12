# Contributing to Protostar

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [pnpm](https://pnpm.io/) (pinned via `packageManager` in root `package.json`)

> **No `npm` invocations.** The repo uses pnpm exclusively. CI, scripts, and docs all assume pnpm.

## Setup

```bash
git clone https://github.com/dgtlntv/protostar.git
cd protostar
pnpm install
```

## Workspace Layout

| Package | Path | Published |
|---|---|---|
| `@dgtlntv/protostar` | `packages/protostar/` | Yes — the library |
| `@dgtlntv/protostar-codec` | `packages/protostar-codec/` | Yes — URL encoder/decoder + CLI |
| `@dgtlntv/playground` | `packages/playground/` | No — dev app + GitHub Pages demo |

## Standard Scripts

Every package exposes these scripts where applicable. Root `package.json` delegates via `pnpm -r` or `pnpm --filter`:

| Script | What it does |
|---|---|
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint .` |
| `lint:fix` | `eslint . --fix` |
| `test:unit` | `vitest run` (protostar, codec) |
| `test:e2e` | `playwright test` (playground) |
| `build` | Vite build |
| `dev` | Vite dev server (playground) |

### Running from the root

```bash
pnpm dev                # playground dev server
pnpm build              # build all packages
pnpm test:unit          # unit tests across workspace
pnpm test:e2e           # e2e tests (playground)
pnpm typecheck          # typecheck all packages
pnpm lint               # lint all packages
pnpm ci                 # typecheck + lint + test (full local check)
```

### Running per-package

```bash
pnpm --filter @dgtlntv/protostar test:unit
pnpm --filter @dgtlntv/protostar-codec test:unit
pnpm --filter @dgtlntv/playground test:e2e
```

## Adding a New Package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json` (extending `../../tsconfig.base.json`), and a `src/` directory.
2. Expose the standard script names (`typecheck`, `lint`, `build`, `test:unit` where applicable) so root orchestration via `pnpm -r` picks them up.
3. Add the package to the "Workspace Layout" table in this file and in `.claude/architecture.md`.

## Shim Asymmetry

The `@dgtlntv/protostar` library build bundles all runtime deps with Node shims baked in — downstream consumers need no Vite config. The playground's dev build resolves the lib via workspace symlink to `src/` (for HMR), so it re-applies the same shim aliases. This is the standard monorepo pattern: whoever bundles the source is on the hook for the shims.

## Release Flow

Both `@dgtlntv/protostar` and `@dgtlntv/protostar-codec` are published to npm.

### Pre-release checklist

1. Ensure `pnpm ci` is green on `main`.
2. Bump versions in `packages/protostar/package.json` and `packages/protostar-codec/package.json`.
3. Update `CHANGELOG.md` with the new version's changes.

### Publishing

```bash
# Dry run — verify the publishable artifacts are well-formed
pnpm release:dry-run

# Publish both packages
pnpm release
```

`pnpm release` runs `pnpm -r publish --access public --no-git-checks`. It requires `pnpm login` to npm with publish rights on the `@dgtlntv` scope.

### Post-publish

1. Commit: `release: v<X.Y.Z>`
2. Tag: `git tag protostar-v<X.Y.Z> codec-v<X.Y.Z>` and push tags.
3. **Manual smoke** (first few releases): in a fresh tmp directory outside the workspace:
   ```bash
   mkdir /tmp/smoke && cd /tmp/smoke
   npm init -y
   npm install @dgtlntv/protostar @dgtlntv/protostar-codec
   ```
   Write a tiny script that imports both, instantiates the lib, and calls `encode`/`decode` on the codec. Confirm no errors.

### Versioning

Both packages are versioned independently. Use [semver](https://semver.org/):
- Breaking changes → major bump
- New features → minor bump
- Bug fixes → patch bump

Automated release workflows (GitHub Actions on tag push) and changesets are deferred until release frequency justifies the tooling.
