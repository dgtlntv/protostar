import path from "path"
import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"

// Base configuration used by all build types
const baseConfig = {
    base: process.env.BASE_PATH || "/",
    plugins: [
        nodePolyfills({
            include: ["path", "process"],
            globals: {
                Buffer: true,
                global: true,
                process: true,
            },
            protocolImports: true,
        }),
    ],
    json: {
        stringify: true,
    },
    resolve: {
        alias: {
            readline: path.resolve(__dirname, "./src/shims/readlineShim.js"),

            // The browser version of yargs for some reason imports cliui and yargs from unpkg
            // Since I don't want to have an additional network request and instead just package it
            // we are aliasing it here instead so it uses a local version.
            "https://unpkg.com/cliui@7.0.1/index.mjs": "cliui",
            "https://unpkg.com/yargs-parser@19.0.0/browser.js": path.resolve(
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
            entry: "src/react.js",
            name: "Protostar",
            formats: ["es", "umd"],
            fileName: (format) => `index.${format}.js`,
        },
        rollupOptions: {
            external: ["react", "react-dom"],
            output: {
                globals: {
                    react: "React",
                    "react-dom": "ReactDOM",
                },
            },
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
