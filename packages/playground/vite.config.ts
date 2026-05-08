import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LIB_PACKAGE_DIR = path.resolve(__dirname, "../protostar")
const LIB_SHIMS_DIR = path.resolve(LIB_PACKAGE_DIR, "src/shims")

/**
 * Playground dev/app config. The library lives in `packages/protostar/`;
 * this config consumes it via the workspace symlink
 * `node_modules/@dgtlntv/protostar`. The lib's `exports` map points at
 * `./src/library.ts` for workspace consumers — its `publishConfig` swaps
 * those entries to `./dist/...` at `pnpm publish` time, so npm consumers
 * still get the built bundle.
 *
 * Shim aliases come along for the ride: in dev (and the playground app
 * build) the lib's `src/library.ts` is bundled directly through Vite's
 * resolver, so pi-tui's Node-only transitive imports (`node:module`,
 * `node:perf_hooks`, `child_process`, `fs`, `os`, `path`, `events`) need
 * to resolve to the same shims the lib build uses. Phase 3.D bakes these
 * shims into the published lib bundle and removes this duplication on
 * the consumer side; for now the playground still bundles lib source
 * through Vite, so the aliases stay.
 */
export default defineConfig({
    base: process.env.BASE_PATH || "/",
    plugins: [],
    json: {
        stringify: true,
    },
    resolve: {
        alias: {
            "node:module": path.resolve(LIB_SHIMS_DIR, "nodeModuleShim.js"),
            "node:perf_hooks": path.resolve(
                LIB_SHIMS_DIR,
                "nodePerfHooksShim.js"
            ),

            events: path.resolve(LIB_SHIMS_DIR, "nodeEventsShim.js"),
            "node:events": path.resolve(LIB_SHIMS_DIR, "nodeEventsShim.js"),

            child_process: path.resolve(
                LIB_SHIMS_DIR,
                "nodeChildProcessShim.js"
            ),
            fs: path.resolve(LIB_SHIMS_DIR, "nodeFsShim.js"),
            "node:fs": path.resolve(LIB_SHIMS_DIR, "nodeFsShim.js"),
            os: path.resolve(LIB_SHIMS_DIR, "nodeOsShim.js"),
            "node:os": path.resolve(LIB_SHIMS_DIR, "nodeOsShim.js"),
            path: path.resolve(LIB_SHIMS_DIR, "nodePathShim.js"),
            "node:path": path.resolve(LIB_SHIMS_DIR, "nodePathShim.js"),

            "https://unpkg.com/cliui@8.0.1/index.mjs": "cliui",
            "https://unpkg.com/yargs-parser@21.1.1/browser.js": path.resolve(
                LIB_PACKAGE_DIR,
                "node_modules/yargs-parser/browser.js"
            ),
        },
    },
})
