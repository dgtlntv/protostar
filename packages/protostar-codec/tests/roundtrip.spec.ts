/**
 * @file End-to-end round-trip checks: `decode(await encode(x))` must
 * deep-equal `x` for every realistic input shape. Locks the encoded
 * payload of the bundled fixtures against a soft size budget so a
 * future schema or fixture change that blows past the realistic URL-bar
 * limit fails loudly here.
 */

import { describe, it, expect } from "vitest"
import demoCommands from "../../playground/src/test-commands.json"
import userCommands from "../../playground/src/commands.json"
import { encode, decode } from "../src/index.js"
import type { Commands } from "@dgtlntv/protostar"

/**
 * Build a synthetic minimal `Commands` value that exercises the smallest
 * possible round-trip path — single command, single text component.
 */
function minimalCommands(): Commands {
    return {
        welcome: "hi",
        variables: {},
        commands: {
            ping: {
                description: "Reply with pong",
                handler: { component: "text", output: "pong" },
            },
        },
    }
}

/**
 * Build a synthetic large-but-realistic `Commands` value. Used to
 * confirm that compression actually helps for inputs with the kind of
 * structural repetition that real config files have (lots of commands
 * with similarly-shaped handlers and option blocks).
 */
function largeCommands(commandCount = 200): Commands {
    const commands: Commands["commands"] = {}
    for (let i = 0; i < commandCount; i++) {
        commands[`cmd${i}`] = {
            description: `Test command number ${i}`,
            options: {
                verbose: {
                    type: "boolean",
                    describe: "Print extra logging",
                    default: false,
                },
                output: {
                    type: "string",
                    describe: "Where to write the result",
                    default: "stdout",
                },
            },
            handler: [
                { component: "text", output: `Running command ${i}…` },
                { component: "text", output: `Done with command ${i}.` },
            ],
        }
    }
    return {
        welcome: "Synthetic large fixture for round-trip testing.",
        variables: { author: "test" },
        commands,
    }
}

describe("encode + decode round-trip", () => {
    it("round-trips the bundled test-commands.json", async () => {
        const payload = await encode(demoCommands as Commands)
        const result = await decode(payload)
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.commands).toEqual(demoCommands)
        }
    })

    it("round-trips the user-facing commands.json", async () => {
        const payload = await encode(userCommands as Commands)
        const result = await decode(payload)
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.commands).toEqual(userCommands)
        }
    })

    it("round-trips a synthetic minimal Commands", async () => {
        const minimal = minimalCommands()
        const payload = await encode(minimal)
        const result = await decode(payload)
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.commands).toEqual(minimal)
        }
    })

    it("round-trips a synthetic large Commands and actually compresses", async () => {
        const large = largeCommands()
        const rawJson = JSON.stringify(large)
        const payload = await encode(large)
        // Encoded payload (base64 of compressed bytes) is under half
        // the raw JSON length on this input shape — base64 inflates by
        // ~33%, so a >2× ratio in our favor confirms deflate is doing
        // real work.
        expect(payload.length * 2).toBeLessThan(rawJson.length)
        const result = await decode(payload)
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.commands).toEqual(large)
        }
    })

    it("encoded payload for the user-facing demo fits in a sensible URL-bar budget", async () => {
        // 2000 chars is the realistic URL-bar limit. Soft assertion
        // documented in the testing strategy — fails loud if a future
        // schema or fixture change makes the user-facing demo URL
        // unfriendly to share. Applied to commands.json because that's
        // the realistic shareable demo; test-commands.json is the
        // coverage fixture that exercises every component (heavier by
        // design — the soft budget below documents that it lives well
        // under any browser's hard URL limit but past the friendly
        // 2000-char mark).
        const userPayload = await encode(userCommands as Commands)
        expect(userPayload.length).toBeLessThan(2000)
        const coveragePayload = await encode(demoCommands as Commands)
        expect(coveragePayload.length).toBeLessThan(4000)
    })
})
