// @ts-check

import tseslint from "typescript-eslint"

/**
 * Shared ESLint flat config for the Protostar monorepo.
 *
 * Uses typescript-eslint's `recommendedTypeChecked` rule set across all
 * package source and test files. Per-rule overrides below document why
 * the default is loosened; each one is a deliberate choice, not a blanket
 * escape hatch.
 */
export default tseslint.config(
    // Global ignores — build artifacts, deps, non-TS config files.
    {
        ignores: [
            "**/dist/",
            "**/node_modules/",
            "**/*.js",
            "**/*.cjs",
            "**/*.mjs",
            "**/vite.config.ts",
            "**/vitest.config.ts",
            "**/playwright.config.ts",
        ],
    },

    // Base: typescript-eslint recommended with type checking.
    ...tseslint.configs.recommendedTypeChecked,

    // Parser options: use projectService so each file resolves to its
    // nearest tsconfig.json automatically.
    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // Rule overrides applied to all TS files.
    {
        files: ["packages/**/src/**/*.ts", "packages/**/tests/**/*.ts"],
        rules: {
            // Allow intentionally-unused parameters prefixed with `_`.
            // Common pattern for interface compliance (e.g., adapters that
            // must accept params they don't use in the browser shim).
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],

        },
    },

    // yargs v18's `yargs/browser` entry ships a `browser.d.ts` that
    // references `build/lib/yargs-factory`, but the package's `files`
    // glob (`!**/*.d.ts`) excludes every declaration file from the
    // published tarball. The default export resolves to `any`, so every
    // chained call on a yargs instance triggers no-unsafe-*.
    //
    // Rather than suppressing per-file, we added a local `YargsInstance`
    // interface (`src/types/yargs-browser.d.ts`) covering the subset of
    // the API we use. The only remaining suppression is a single
    // eslint-disable-next-line on the `Yargs()` factory call itself.
    //
    // Revisit when yargs >18.0.0 publishes its declaration files.
)
