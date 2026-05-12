/**
 * @file Specs for the Ctrl+C cancellation pipeline. Covers the abort-aware
 * `sleep()` primitive, `runComponents`'s sentinel-throw between steps, and
 * the scrollback snapshots prompts leave behind when their context's
 * `signal` aborts mid-prompt.
 */

import { describe, it, expect } from "vitest"
import { makeHarness, flushRender } from "./helpers/componentHarness.js"
import { runComponents } from "../../src/commands/runComponents.js"
import {
    CommandCanceledError,
    isCommandCanceledError,
} from "../../src/shell/CommandCanceledError.js"
import { sleep } from "../../src/components/duration.js"
import type { Component } from "../../src/types/commands.js"

const ENTER = "\r"

describe("sleep with abort signal", () => {
    it("resolves immediately when the signal is already aborted", async () => {
        const ctrl = new AbortController()
        ctrl.abort()
        const start = Date.now()
        await sleep(1000, ctrl.signal)
        expect(Date.now() - start).toBeLessThan(50)
    })

    it("resolves early when the signal aborts during the wait", async () => {
        const ctrl = new AbortController()
        const start = Date.now()
        const pending = sleep(1000, ctrl.signal)
        setTimeout(() => ctrl.abort(), 20)
        await pending
        expect(Date.now() - start).toBeLessThan(200)
    })

    it("ignores abort once the timer has fired", async () => {
        const ctrl = new AbortController()
        await sleep(20, ctrl.signal)
        // No throw / no hang; the late abort is harmless.
        ctrl.abort()
    })
})

describe("runComponents abort handling", () => {
    it("throws CommandCanceledError when the signal is already aborted", async () => {
        const ctrl = new AbortController()
        ctrl.abort()
        const h = makeHarness({ signal: ctrl.signal })
        await expect(
            runComponents(
                [{ component: "text", output: "should not render" }],
                h.ctx
            )
        ).rejects.toBeInstanceOf(CommandCanceledError)
    })

    it("stops walking the handler list once the signal aborts mid-flight", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const components: Component[] = [
            { component: "text", output: "first", duration: 50 },
            { component: "text", output: "second" },
            { component: "text", output: "third" },
        ]
        const dispatch = runComponents(components, h.ctx).catch(
            (e: unknown) => e,
        )
        // Abort during the first component's sleep.
        setTimeout(() => ctrl.abort(), 10)
        const result: unknown = await dispatch
        expect(isCommandCanceledError(result)).toBe(true)
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("first")
        expect(joined).not.toContain("second")
        expect(joined).not.toContain("third")
    })

    it("isCommandCanceledError matches the sentinel by name", () => {
        const fake: { name: string; message: string } = {
            name: "CommandCanceledError",
            message: "x",
        }
        expect(isCommandCanceledError(fake)).toBe(true)
        expect(isCommandCanceledError(new Error("nope"))).toBe(false)
    })
})

describe("spinner cancellation", () => {
    it("tears down the live row when the signal aborts and emits no conclusion glyph", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const pending = h.run({
            component: "spinner",
            output: "Working forever",
            duration: 5000,
        })
        await flushRender(h.tui, h.term)
        ctrl.abort()
        await pending
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        // No conclusion glyph and no concluding text — the spinner just
        // cleans up; the shell loop is responsible for the `^C` echo.
        expect(joined).not.toContain("✔")
        expect(joined).not.toContain("✖")
    })
})

describe("progressBar cancellation", () => {
    it("removes the bar when the signal aborts mid-animation", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const pending = h.run({
            component: "progressBar",
            output: "Loading",
            duration: 5000,
        })
        await flushRender(h.tui, h.term)
        setTimeout(() => ctrl.abort(), 30)
        await pending
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).not.toContain("100%")
    })
})

describe("text-with-duration cancellation", () => {
    it("returns early when the signal aborts during the pause", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const start = Date.now()
        const pending = h.run({
            component: "text",
            output: "Visible",
            duration: 5000,
        })
        setTimeout(() => ctrl.abort(), 20)
        await pending
        expect(Date.now() - start).toBeLessThan(500)
    })
})

describe("InlinePrompt-based prompts on abort", () => {
    it("leaves a frozen `? message <buffer>` snapshot when input aborts", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const c: Component = {
            component: "input",
            name: "answer",
            message: "Type:",
        }
        const pending = h.run(c)
        await flushRender(h.tui, h.term)
        for (const ch of "hello") h.term.sendInput(ch)
        await flushRender(h.tui, h.term)
        ctrl.abort()
        await pending
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("Type:")
        expect(joined).toContain("hello")
        // No green checkmark — abort is not a successful submission.
        expect(joined).not.toContain("✔")
        // Variable was not persisted.
        expect(h.variables.get("answer")).toBeUndefined()
    })

    it("masks the snapshot for password prompts", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const c: Component = {
            component: "password",
            name: "pw",
            message: "Pwd:",
        }
        const pending = h.run(c)
        await flushRender(h.tui, h.term)
        for (const ch of "abc") h.term.sendInput(ch)
        await flushRender(h.tui, h.term)
        ctrl.abort()
        await pending
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("Pwd:")
        expect(joined).toContain("•••")
        expect(joined).not.toContain("abc")
    })
})

describe("SelectList-based prompts on abort", () => {
    it("removes the list and leaves the messageLine in scrollback", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const c: Component = {
            component: "select",
            name: "color",
            message: "Pick one:",
            choices: [
                { name: "Red", value: "red" },
                { name: "Green", value: "green" },
            ],
        }
        const pending = h.run(c)
        await flushRender(h.tui, h.term)
        ctrl.abort()
        await pending
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("Pick one:")
        expect(joined).not.toContain("✔")
        expect(h.variables.get("color")).toBeUndefined()
    })

    it("multiSelect: same snapshot semantics", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const c: Component = {
            component: "multiSelect",
            name: "tags",
            message: "Tags:",
            choices: [
                { name: "Bug", value: "bug" },
                { name: "Feature", value: "feature" },
            ],
        }
        const pending = h.run(c)
        await flushRender(h.tui, h.term)
        ctrl.abort()
        await pending
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("Tags:")
        expect(h.variables.get("tags")).toBeUndefined()
    })

    it("confirm: leaves a `? message` snapshot and persists nothing", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const c: Component = {
            component: "confirm",
            name: "ok",
            message: "Continue?",
        }
        const pending = h.run(c)
        await flushRender(h.tui, h.term)
        ctrl.abort()
        await pending
        await flushRender(h.tui, h.term)
        const joined = (await h.term.getViewport()).join("\n")
        expect(joined).toContain("Continue?")
        expect(joined).not.toContain("(Y/n)")
        expect(h.variables.get("ok")).toBeUndefined()
    })
})

describe("normal Escape cancel still works (no signal abort)", () => {
    it("Escape cancels an input prompt without writing a snapshot", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "input",
            name: "answer",
            message: "Type:",
        }
        const pending = h.run(c)
        await flushRender(h.tui, h.term)
        h.term.sendInput("\x1b")
        await pending
        await flushRender(h.tui, h.term)
        // The `?` glyph stays on the prompt while it's open; on Escape the
        // prompt is removed entirely (no answer line written, no snapshot).
        expect(h.variables.get("answer")).toBeUndefined()
    })

    it("Enter still submits when the signal exists but never fires", async () => {
        const ctrl = new AbortController()
        const h = makeHarness({ signal: ctrl.signal })
        const c: Component = {
            component: "input",
            name: "answer",
            message: "Type:",
        }
        const pending = h.run(c)
        await flushRender(h.tui, h.term)
        for (const ch of "ok") h.term.sendInput(ch)
        h.term.sendInput(ENTER)
        await pending
        expect(h.variables.get("answer")).toBe("ok")
    })
})
