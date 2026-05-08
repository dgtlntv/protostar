import path from "path"
import { fileURLToPath } from "url"
import { defineConfig } from "vite"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Aliases for the library bundle. pi-tui's terminal/autocomplete modules
 * eagerly import Node-only modules (`node:module`, `node:perf_hooks`,
 * `child_process`, `fs`, `os`, `path`, `events`) for code paths that never
 * run in the browser. Each one resolves to a no-op shim. `yargs/browser`
 * additionally hard-codes unpkg URLs for `cliui` / `yargs-parser`; we
 * redirect those to the locally installed copies to avoid a runtime CDN
 * fetch.
 */
const shimAliases = {
    "node:module": path.resolve(__dirname, "./src/shims/nodeModuleShim.js"),
    "node:perf_hooks": path.resolve(
        __dirname,
        "./src/shims/nodePerfHooksShim.js"
    ),
    events: path.resolve(__dirname, "./src/shims/nodeEventsShim.js"),
    "node:events": path.resolve(__dirname, "./src/shims/nodeEventsShim.js"),
    child_process: path.resolve(
        __dirname,
        "./src/shims/nodeChildProcessShim.js"
    ),
    fs: path.resolve(__dirname, "./src/shims/nodeFsShim.js"),
    "node:fs": path.resolve(__dirname, "./src/shims/nodeFsShim.js"),
    os: path.resolve(__dirname, "./src/shims/nodeOsShim.js"),
    "node:os": path.resolve(__dirname, "./src/shims/nodeOsShim.js"),
    path: path.resolve(__dirname, "./src/shims/nodePathShim.js"),
    "node:path": path.resolve(__dirname, "./src/shims/nodePathShim.js"),
    "https://unpkg.com/cliui@8.0.1/index.mjs": "cliui",
    "https://unpkg.com/yargs-parser@21.1.1/browser.js": path.resolve(
        __dirname,
        "node_modules/yargs-parser/browser.js"
    ),
}

export default defineConfig({
    plugins: [],
    json: {
        stringify: true,
    },
    resolve: {
        alias: shimAliases,
    },
    build: {
        lib: {
            entry: "src/library.ts",
            name: "Protostar",
            formats: ["es", "umd"],
            fileName: (format) => `index.${format}.js`,
        },
    },
})
