import path from "path"
import { defineConfig } from "vite"

// Base configuration used by all build types
const baseConfig = {
    base: process.env.BASE_PATH || "/",
    plugins: [],
    json: {
        stringify: true,
    },
    resolve: {
        alias: {
            // pi-tui's terminal.js eagerly imports `createRequire` from
            // node:module to support its Node-only ProcessTerminal class.
            // We never instantiate that class in the browser, so a no-op
            // shim is sufficient to keep the eager import from crashing.
            "node:module": path.resolve(__dirname, "./src/shims/nodeModuleShim.js"),
            "node:perf_hooks": path.resolve(__dirname, "./src/shims/nodePerfHooksShim.js"),

            // pi-tui's `stdin-buffer.js` does `class StdinBuffer extends
            // EventEmitter`, so the `extends` evaluates at module load.
            // StdinBuffer is only instantiated by pi-tui's ProcessTerminal,
            // which never runs in the browser — an empty extendable class
            // is enough.
            events: path.resolve(__dirname, "./src/shims/nodeEventsShim.js"),
            "node:events": path.resolve(__dirname, "./src/shims/nodeEventsShim.js"),

            // pi-tui's autocomplete.js eagerly imports `child_process`, `fs`,
            // and `os` for its file-path autocomplete provider. We never
            // instantiate that provider in the browser, so each module
            // resolves to a no-op shim.
            child_process: path.resolve(__dirname, "./src/shims/nodeChildProcessShim.js"),
            fs: path.resolve(__dirname, "./src/shims/nodeFsShim.js"),
            "node:fs": path.resolve(__dirname, "./src/shims/nodeFsShim.js"),
            os: path.resolve(__dirname, "./src/shims/nodeOsShim.js"),
            "node:os": path.resolve(__dirname, "./src/shims/nodeOsShim.js"),
            // pi-tui's autocomplete/terminal/tui import `path`/`node:path`
            // for path joining; the same provider rationale applies.
            path: path.resolve(__dirname, "./src/shims/nodePathShim.js"),
            "node:path": path.resolve(__dirname, "./src/shims/nodePathShim.js"),

            // `yargs/browser` imports `cliui` and `yargs-parser` from unpkg
            // URLs hard-coded into yargs's browser shim. Aliasing those URLs
            // to the locally installed copies avoids a runtime network
            // request (and the hard-coded version pins).
            "https://unpkg.com/cliui@8.0.1/index.mjs": "cliui",
            "https://unpkg.com/yargs-parser@21.1.1/browser.js": path.resolve(
                __dirname,
                "node_modules/yargs-parser/browser.js"
            ),
        },
    },
}

// Library config
const getLibConfig = () => ({
    ...baseConfig,
    build: {
        lib: {
            entry: "src/library.ts",
            name: "Protostar",
            formats: ["es", "umd"],
            fileName: (format) => `index.${format}.js`,
        },
    },
})

// App config (default)
const getAppConfig = () => ({
    ...baseConfig,
})

export default defineConfig(({ command, mode }) => {
    if (command === "build" && mode === "lib") {
        return getLibConfig()
    }

    return getAppConfig()
})
