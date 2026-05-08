/**
 * @file Spawns the built CLI binary as a child process and asserts the
 * stdout / stderr / exit-code contract. The binary lives at
 * `dist/cli.js` after `pnpm build`. CI builds before running tests; the
 * `beforeAll` here builds on demand so that local `pnpm test:unit`
 * works on a fresh checkout without the user having to remember the
 * build step.
 */

import { describe, it, expect, beforeAll } from "vitest"
import { spawn, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import path from "node:path"
import demoCommands from "../../playground/src/test-commands.json"
import { decode } from "../src/index.js"
import type { Commands } from "@dgtlntv/protostar"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(__dirname, "..")
const cliPath = path.join(packageRoot, "dist", "cli.js")

const DEFAULT_HOST = "https://dgtlntv.github.io/protostar/"

interface RunResult {
    stdout: string
    stderr: string
    code: number | null
}

/** Spawn the CLI with given args, pipe `input` to stdin, collect output. */
function runCli(args: string[], input: string): Promise<RunResult> {
    return new Promise((resolve, reject) => {
        const child = spawn("node", [cliPath, ...args], {
            stdio: ["pipe", "pipe", "pipe"],
        })
        let stdout = ""
        let stderr = ""
        child.stdout.setEncoding("utf8")
        child.stderr.setEncoding("utf8")
        child.stdout.on("data", (chunk) => (stdout += chunk))
        child.stderr.on("data", (chunk) => (stderr += chunk))
        child.on("error", reject)
        child.on("close", (code) => resolve({ stdout, stderr, code }))
        child.stdin.write(input)
        child.stdin.end()
    })
}

beforeAll(() => {
    // Always rebuild before exercising the CLI. The build is fast
    // enough (~tens of ms) that paying it on every test session is a
    // better trade than risking a stale `dist/cli.js` masking a
    // regression in source. CI's separate build step makes this a
    // double-build there, also fine.
    const result = spawnSync("pnpm", ["build"], {
        cwd: packageRoot,
        stdio: "inherit",
    })
    if (result.status !== 0) {
        throw new Error(`pnpm build failed with exit ${result.status}`)
    }
    if (!existsSync(cliPath)) {
        throw new Error(`CLI build output missing: ${cliPath}`)
    }
}, 60_000)

describe("protostar-encode CLI", () => {
    it("prints a default-host URL and exits 0", async () => {
        const input = JSON.stringify(demoCommands)
        const { stdout, stderr, code } = await runCli([], input)
        expect(code).toBe(0)
        expect(stderr).toBe("")
        expect(stdout.startsWith(`${DEFAULT_HOST}#p1=`)).toBe(true)
        const fragment = stdout.slice(DEFAULT_HOST.length + 1)
        expect(fragment).toMatch(/^p1=[A-Za-z0-9_\-]+$/)
    })

    it("respects --host", async () => {
        const input = JSON.stringify(demoCommands)
        const { stdout, code } = await runCli(
            ["--host", "https://my.site/path"],
            input
        )
        expect(code).toBe(0)
        expect(stdout.startsWith("https://my.site/path#p1=")).toBe(true)
    })

    it("with --no-host writes only the fragment payload", async () => {
        const input = JSON.stringify(demoCommands)
        const { stdout, code } = await runCli(["--no-host"], input)
        expect(code).toBe(0)
        expect(stdout).toMatch(/^p1=[A-Za-z0-9_\-]+$/)
    })

    it("rejects schema-invalid input with a non-zero exit and stderr message", async () => {
        const input = JSON.stringify({ welcome: 42, variables: {}, commands: {} })
        const { stdout, stderr, code } = await runCli([], input)
        expect(code).not.toBe(0)
        expect(stdout).toBe("")
        expect(stderr).toMatch(/welcome/)
    })

    it("rejects invalid JSON on stdin with a non-zero exit", async () => {
        const { stdout, stderr, code } = await runCli([], "not json {{{")
        expect(code).not.toBe(0)
        expect(stdout).toBe("")
        expect(stderr).toMatch(/JSON/)
    })

    it("CLI output round-trips back through decode", async () => {
        const input = JSON.stringify(demoCommands)
        const { stdout, code } = await runCli(["--no-host"], input)
        expect(code).toBe(0)
        const result = await decode(stdout)
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.commands).toEqual(demoCommands as Commands)
        }
    })
})
