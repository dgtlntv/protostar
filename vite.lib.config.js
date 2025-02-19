import { defineConfig } from "vite"
import { nodePolyfills } from "vite-plugin-node-polyfills"

export default defineConfig({
    plugins: [nodePolyfills()],
    build: {
        lib: {
            entry: "src/react.js",
            name: "CLIPrototype",
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
