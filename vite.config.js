import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import path from "path"
import processBindingShim from "./src/shims/processBindingShim.js"

export default defineConfig({
    base: "/cli-prototype/",
    plugins: [
        nodePolyfills({
            include: ["path", "process", "stream"],
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
            readline: "readline-browser",
            "node:readline": "readline-browser",
            "node:async_hooks": path.resolve(
                __dirname,
                "./src/shims/asyncHooksShim.js"
            ),
        },
    },
    define: {
        "process.binding": `(${processBindingShim.toString()})`,
        "process.env": JSON.stringify({
            TERM: "linux",
        }),
        "process.versions": JSON.stringify({
            node: "20.17.0.0",
        }),
        "process.addListener": "()=>{}",
    },
})
