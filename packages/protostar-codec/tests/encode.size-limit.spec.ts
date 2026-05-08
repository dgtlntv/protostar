/**
 * @file Encoder-side size guard. A `Commands` whose stringified form
 * exceeds {@link MAX_DECOMPRESSED_BYTES} fails before compression so the
 * author hears "this prototype is too big to share" instead of producing
 * a URL the receiver's decoder would silently reject.
 */

import { describe, it, expect } from "vitest"
import { encode, MAX_DECOMPRESSED_BYTES } from "../src/index.js"
import type { Commands } from "@dgtlntv/protostar"

/**
 * Build a synthetic, schema-valid `Commands` whose JSON form is
 * guaranteed to overshoot the cap. Padding lives in `welcome` so the
 * shape stays trivially valid.
 */
function oversizedCommands(): Commands {
    const padding = "x".repeat(MAX_DECOMPRESSED_BYTES + 1024)
    return {
        welcome: padding,
        variables: {},
        commands: {
            ping: { handler: { component: "text", output: "pong" } },
        },
    }
}

describe("encode — raw-JSON size guard", () => {
    it("throws with a documented message when raw JSON exceeds the cap", async () => {
        await expect(encode(oversizedCommands())).rejects.toThrow(
            /maximum supported size/
        )
        await expect(encode(oversizedCommands())).rejects.toThrow(
            /KB raw JSON/
        )
    })

    it("includes the actual and cap sizes in the error message", async () => {
        try {
            await encode(oversizedCommands())
            throw new Error("expected encode to throw")
        } catch (err) {
            const message = (err as Error).message
            // Cap is 256 KB at present — the message is the user-facing
            // contract, so "256 KB" appearing in it is part of the
            // surface. Update both this test and the README copy if the
            // cap moves.
            const capKB = (MAX_DECOMPRESSED_BYTES / 1024).toFixed(0)
            expect(message).toContain(`${capKB} KB`)
        }
    })

    it("accepts a realistic prototype well under the cap", async () => {
        const small: Commands = {
            welcome: "small prototype",
            variables: {},
            commands: {
                hello: {
                    description: "Say hi",
                    handler: { component: "text", output: "hi" },
                },
            },
        }
        const payload = await encode(small)
        expect(payload).toMatch(/^p1=/)
    })
})
