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

            // yargs's browser entry (`yargs/browser`) ships weak types that
            // resolve to `{}` in strict tsconfigs. Every chained call on a
            // yargs instance triggers no-unsafe-*. Suppressing per-line in
            // buildYargs.ts would add 20+ directives for correct, well-typed
            // code. Downgrade to warn so they stay visible without blocking CI.
            "@typescript-eslint/no-unsafe-call": "warn",
            "@typescript-eslint/no-unsafe-member-access": "warn",
            "@typescript-eslint/no-unsafe-assignment": "warn",
            "@typescript-eslint/no-unsafe-return": "warn",
        },
    },
)
