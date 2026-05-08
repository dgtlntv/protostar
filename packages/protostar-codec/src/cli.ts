#!/usr/bin/env node
/**
 * @file `protostar-encode` — Node CLI around `encode()`. Reads a
 * `commands.json` from stdin, prints a shareable URL (or just the
 * fragment) to stdout. Exits non-zero with the AJV path on stderr if
 * the input fails schema validation.
 *
 * Usage:
 *   cat commands.json | protostar-encode                 # default host
 *   cat commands.json | protostar-encode --host <url>    # custom prefix
 *   cat commands.json | protostar-encode --no-host       # fragment only
 */

import { encode } from "./encode.js"
import type { Commands } from "@dgtlntv/protostar"

/**
 * Parsed CLI argument shape. `host` is `null` only when `--no-host` is
 * passed; otherwise it carries the full URL prefix (including any path
 * segment) that gets concatenated with `#<payload>`.
 */
interface CliArgs {
    host: string | null
}

/**
 * Default URL prefix when neither `--host` nor `--no-host` is provided —
 * the GitHub Pages playground deployment is the canonical host for share
 * links, so producing a working URL with no flags is the right default.
 */
const DEFAULT_HOST = "https://dgtlntv.github.io/protostar/"

/**
 * Tiny hand-rolled argv parser. Pulls in zero deps — the codec ships in
 * the playground bundle, and dragging `yargs` (or a parser thereof) into
 * a browser-runnable lib for two flags would be silly.
 */
function parseArgs(argv: string[]): CliArgs {
    let host: string | null = DEFAULT_HOST
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === "--no-host") {
            host = null
        } else if (arg === "--host") {
            const value = argv[i + 1]
            if (value === undefined) {
                throw new Error("--host requires a value")
            }
            host = value
            i++
        } else if (arg === "--help" || arg === "-h") {
            process.stdout.write(usage())
            process.exit(0)
        } else {
            throw new Error(`unknown argument: ${arg}`)
        }
    }
    return { host }
}

/** Block of help text printed on `--help`. Plain text, no chalk. */
function usage(): string {
    return [
        "Usage: protostar-encode [--host <url> | --no-host]",
        "",
        "Reads a Protostar commands JSON document from stdin and writes a",
        "shareable URL (or fragment) to stdout.",
        "",
        "Options:",
        "  --host <url>   URL prefix to prepend to the encoded fragment.",
        `                 Defaults to ${DEFAULT_HOST}`,
        "  --no-host      Print only the fragment payload (no scheme/host).",
        "  --help, -h     Show this message.",
        "",
    ].join("\n")
}

/** Slurp the whole stdin into a string. */
async function readStdin(): Promise<string> {
    let buf = ""
    process.stdin.setEncoding("utf8")
    for await (const chunk of process.stdin) {
        buf += chunk as string
    }
    return buf
}

/** Top-level main — wraps every fail mode into a stderr line + exit 1. */
async function main(): Promise<void> {
    let args: CliArgs
    try {
        args = parseArgs(process.argv.slice(2))
    } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`)
        process.exit(2)
    }

    const raw = await readStdin()

    let commands: Commands
    try {
        commands = JSON.parse(raw) as Commands
    } catch (err) {
        process.stderr.write(`stdin is not valid JSON: ${(err as Error).message}\n`)
        process.exit(1)
    }

    let payload: string
    try {
        payload = await encode(commands)
    } catch (err) {
        process.stderr.write(`${(err as Error).message}\n`)
        process.exit(1)
    }

    const output = args.host === null ? payload : `${args.host}#${payload}`
    process.stdout.write(output)
}

void main()
