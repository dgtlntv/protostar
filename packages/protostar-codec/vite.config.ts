import { defineConfig } from "vite"

/**
 * Library build for the codec. Produces two ES bundles in `dist/`:
 * `index.js` (the public API: encode/decode/validateCommands) and
 * `cli.js` (the `protostar-encode` Node binary).
 *
 * `ajv` is externalized: published consumers (and the playground via the
 * workspace symlink) install it transitively. Bundling AJV would only add
 * weight without removing a dependency the consumer wouldn't already pull
 * in for any other JSON Schema work.
 *
 * The bundled JSON schema is inlined: `import schema from "../schema/..."`
 * resolves at build time so consumers don't need a separate file.
 */
export default defineConfig({
    build: {
        target: "node18",
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
        minify: false,
        lib: {
            entry: {
                index: "src/index.ts",
                cli: "src/cli.ts",
            },
            formats: ["es"],
        },
        rollupOptions: {
            external: [
                "ajv",
                /^ajv\//,
                /^node:/,
            ],
        },
    },
})
