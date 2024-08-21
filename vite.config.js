import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"
import path from "path"

export default defineConfig({
    base: "/cli-prototype/",
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
        },
    },
})
