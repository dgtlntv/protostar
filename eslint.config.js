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
    // Upstream bug — the fix is removing the `!**/*.d.ts` exclusion from
    // yargs's `package.json#files`. Until that ships, suppress the rules
    // on the three files that touch the yargs instance and the one test
    // file that stubs it.
    //
    // Revisit when yargs >18.0.0 publishes its declaration files.
    {
        files: [
            "packages/protostar/src/commands/buildYargs.ts",
            "packages/protostar/src/shell/ShellLoop.ts",
            "packages/protostar/src/Protostar.ts",
            "packages/protostar/tests/unit/cancellation.spec.ts",
        ],
        rules: {
            "@typescript-eslint/no-unsafe-call": "off",
            "@typescript-eslint/no-unsafe-member-access": "off",
            "@typescript-eslint/no-unsafe-assignment": "off",
            "@typescript-eslint/no-unsafe-return": "off",
        },
    },
)
