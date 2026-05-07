/**
 * @file Happy-path specs for the prompt components. Each test drives the
 * component through the virtual terminal, sends the minimum keystrokes
 * to resolve, and asserts that the value lands in the harness's
 * `VariableStore` under `component.name`.
 */

import { describe, it, expect } from "vitest"
import { makeHarness, flushRender } from "./helpers/componentHarness.js"
import type { Component } from "../../src/types/commands.js"

const ENTER = "\r"
const ESC = "\x1b"
const ARROW_DOWN = "\x1b[B"
const ARROW_UP = "\x1b[A"

/**
 * Run a prompt without awaiting it, then flush the initial render so the
 * test can drive input against the mounted UI. Returns the live promise
 * wrapped in an object — `await start(...)` would otherwise unwrap a
 * promise-returning promise and deadlock waiting for the prompt itself.
 */
async function start(
    h: ReturnType<typeof makeHarness>,
    c: Component
): Promise<{ done: Promise<void> }> {
    const done = h.run(c)
    await flushRender(h.tui, h.term)
    return { done }
}

/**
 * Send a string char-by-char so each printable byte is interpreted as a
 * separate keystroke. The inline-prompt component only treats a chunk as
 * Enter if the whole chunk equals `"\r"` / `"\n"`, so combined sends like
 * `"abc\r"` would otherwise be discarded as containing embedded control
 * bytes.
 */
function type(h: ReturnType<typeof makeHarness>, text: string): void {
    for (const ch of text) h.term.sendInput(ch)
}

describe("input prompt", () => {
    it("persists the submitted line under name", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "input",
            name: "username",
            message: "Enter your username:",
        }
        const { done } = await start(h, c)
        type(h, "alice")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("username")).toBe("alice")
    })

    it("renders the message above the input", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "input",
            name: "x",
            message: "Pick a thing:",
        }
        const { done } = await start(h, c)
        const lines = await h.term.getViewport()
        expect(lines.some((l) => l.includes("Pick a thing:"))).toBe(true)
        type(h, "ok")
        h.term.sendInput(ENTER)
        await done
    })
})

describe("number prompt", () => {
    it("parses a numeric line and persists it", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "number",
            name: "n",
            message: "How many?",
        }
        const { done } = await start(h, c)
        type(h, "42")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("n")).toBe("42")
    })
})

describe("password prompt", () => {
    it("hides typed characters and persists the raw value", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "password",
            name: "pw",
            message: "Password:",
        }
        const { done } = await start(h, c)
        type(h, "hunter2")
        await flushRender(h.tui, h.term)
        const masked = (await h.term.getViewport()).join("\n")
        expect(masked).not.toContain("hunter2")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("pw")).toBe("hunter2")
    })
})

describe("invisible prompt", () => {
    it("persists the typed value without echoing", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "invisible",
            name: "tok",
            message: "Token:",
        }
        const { done } = await start(h, c)
        type(h, "abc")
        await flushRender(h.tui, h.term)
        const view = (await h.term.getViewport()).join("\n")
        expect(view).not.toContain("abc")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("tok")).toBe("abc")
    })
})

describe("list prompt", () => {
    it("splits the submitted line on commas", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "list",
            name: "tags",
            message: "Tags:",
        }
        const { done } = await start(h, c)
        type(h, "a, b, c")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("tags")).toBe(JSON.stringify(["a", "b", "c"]))
    })
})

describe("select prompt", () => {
    it("persists the chosen choice's value", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "select",
            name: "priority",
            message: "Priority?",
            choices: [
                { name: "Low", value: "low" },
                { name: "Medium", value: "medium" },
                { name: "High", value: "high" },
            ],
        }
        const { done } = await start(h, c)
        h.term.sendInput(ARROW_DOWN)
        h.term.sendInput(ARROW_DOWN)
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("priority")).toBe("high")
    })

    it("accepts a bare string-array choices form", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "select",
            name: "color",
            message: "Color?",
            choices: ["red", "green", "blue"],
        }
        const { done } = await start(h, c)
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("color")).toBe("red")
    })
})

describe("autoComplete prompt", () => {
    it("filters the list as the user types and resolves with the value", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "autoComplete",
            name: "fruit",
            message: "Pick a fruit:",
            choices: ["apple", "apricot", "banana", "blueberry"],
        }
        const { done } = await start(h, c)
        type(h, "ban")
        await flushRender(h.tui, h.term)
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("fruit")).toBe("banana")
    })
})

describe("multiSelect prompt", () => {
    it("toggles items with Space and resolves with the picked values", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "multiSelect",
            name: "picks",
            message: "Pick some:",
            choices: [
                { name: "Alpha", value: "alpha" },
                { name: "Beta", value: "beta" },
                { name: "Gamma", value: "gamma" },
            ],
        }
        const { done } = await start(h, c)
        h.term.sendInput(" ") // toggle alpha
        h.term.sendInput(ARROW_DOWN)
        h.term.sendInput(ARROW_DOWN)
        h.term.sendInput(" ") // toggle gamma
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("picks")).toBe(
            JSON.stringify(["alpha", "gamma"])
        )
    })
})

describe("confirm prompt", () => {
    it("Enter accepts the default Yes", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "confirm",
            name: "ok",
            message: "Proceed?",
        }
        const { done } = await start(h, c)
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("ok")).toBe("true")
    })

    it("'y' resolves to true on a single keystroke", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "confirm",
            name: "ok",
            message: "Proceed?",
        }
        const { done } = await start(h, c)
        h.term.sendInput("y")
        await done
        expect(h.variables.get("ok")).toBe("true")
    })

    it("'n' resolves to false on a single keystroke", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "confirm",
            name: "ok",
            message: "Proceed?",
        }
        const { done } = await start(h, c)
        h.term.sendInput("n")
        await done
        expect(h.variables.get("ok")).toBe("false")
    })

    it("renders the (Y/n) hint when the default is true", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "confirm",
            name: "ok",
            message: "Proceed?",
            initial: true,
        }
        const { done } = await start(h, c)
        const view = (await h.term.getViewport()).join("\n")
        expect(view).toContain("(Y/n)")
        h.term.sendInput("y")
        await done
    })

    it("renders the (y/N) hint when the default is false", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "confirm",
            name: "ok",
            message: "Proceed?",
            initial: false,
        }
        const { done } = await start(h, c)
        const view = (await h.term.getViewport()).join("\n")
        expect(view).toContain("(y/N)")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("ok")).toBe("false")
    })
})

describe("toggle prompt", () => {
    it("persists true when the enabled label is the default", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "toggle",
            name: "wifi",
            message: "Wifi:",
            enabled: "On",
            disabled: "Off",
        }
        const { done } = await start(h, c)
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("wifi")).toBe("true")
    })

    it("ArrowLeft moves to the disabled label and Enter persists false", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "toggle",
            name: "wifi",
            message: "Wifi:",
            enabled: "On",
            disabled: "Off",
        }
        const { done } = await start(h, c)
        h.term.sendInput("\x1b[D")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("wifi")).toBe("false")
    })

    it("renders both labels on the same row", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "toggle",
            name: "x",
            message: "Wifi:",
            enabled: "On",
            disabled: "Off",
        }
        const { done } = await start(h, c)
        const lines = await h.term.getViewport()
        const row = lines.find((l) => l.includes("Wifi:")) ?? ""
        expect(row).toContain("Off")
        expect(row).toContain("On")
        h.term.sendInput(ENTER)
        await done
    })
})

describe("form prompt", () => {
    it("collects each field into a single object", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "form",
            name: "address",
            message: "Address:",
            choices: [
                { name: "street", message: "Street" },
                { name: "city", message: "City" },
            ],
        }
        const { done } = await start(h, c)
        type(h, "123 Main")
        h.term.sendInput(ENTER)
        await flushRender(h.tui, h.term)
        type(h, "Springfield")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("address")).toBe(
            JSON.stringify({ street: "123 Main", city: "Springfield" })
        )
    })

    it("renders all fields at once", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "form",
            name: "x",
            message: "Profile",
            choices: [
                { name: "first", message: "First" },
                { name: "last", message: "Last" },
                { name: "email", message: "Email" },
            ],
        }
        const { done } = await start(h, c)
        const view = (await h.term.getViewport()).join("\n")
        expect(view).toContain("First:")
        expect(view).toContain("Last:")
        expect(view).toContain("Email:")
        type(h, "a")
        h.term.sendInput(ENTER)
        type(h, "b")
        h.term.sendInput(ENTER)
        type(h, "c")
        h.term.sendInput(ENTER)
        await done
    })

    it("Tab accepts the placeholder when the buffer is empty", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "form",
            name: "p",
            message: "Profile",
            choices: [
                { name: "first", message: "First", initial: "Ada" },
                { name: "last", message: "Last", initial: "Lovelace" },
            ],
        }
        const { done } = await start(h, c)
        h.term.sendInput("\t") // accept "Ada"
        h.term.sendInput(ENTER)
        await flushRender(h.tui, h.term)
        h.term.sendInput("\t") // accept "Lovelace"
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("p")).toBe(
            JSON.stringify({ first: "Ada", last: "Lovelace" })
        )
    })

    it("typing overrides the placeholder", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "form",
            name: "p",
            message: "Profile",
            choices: [{ name: "first", message: "First", initial: "Ada" }],
        }
        const { done } = await start(h, c)
        type(h, "Grace")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("p")).toBe(JSON.stringify({ first: "Grace" }))
    })

    it("ArrowUp moves between fields", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "form",
            name: "p",
            message: "Profile",
            choices: [
                { name: "a", message: "A" },
                { name: "b", message: "B" },
            ],
        }
        const { done } = await start(h, c)
        type(h, "first")
        h.term.sendInput(ARROW_DOWN)
        type(h, "second")
        h.term.sendInput(ARROW_UP)
        // Cursor is back on field "a"; appending should append to "first".
        type(h, "X")
        h.term.sendInput(ARROW_DOWN)
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("p")).toBe(
            JSON.stringify({ a: "firstX", b: "second" })
        )
    })
})

describe("basicAuth prompt", () => {
    it("resolves to true when credentials match", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "basicAuth",
            name: "auth",
            message: "Sign in:",
            username: "alice",
            password: "letmein",
        }
        const { done } = await start(h, c)
        type(h, "alice")
        h.term.sendInput(ENTER)
        await flushRender(h.tui, h.term)
        type(h, "letmein")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("auth")).toBe("true")
    })

    it("resolves to false when credentials don't match", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "basicAuth",
            name: "auth",
            message: "Sign in:",
            username: "alice",
            password: "letmein",
        }
        const { done } = await start(h, c)
        type(h, "alice")
        h.term.sendInput(ENTER)
        await flushRender(h.tui, h.term)
        type(h, "nope")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("auth")).toBe("false")
    })
})

describe("sort prompt", () => {
    it("submits the unchanged order on a bare Enter", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "sort",
            name: "order",
            message: "Order:",
            choices: ["one", "two", "three"],
        }
        const { done } = await start(h, c)
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("order")).toBe(
            JSON.stringify(["one", "two", "three"])
        )
    })

    it("reorders when an item is grabbed and moved", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "sort",
            name: "order",
            message: "Order:",
            choices: ["one", "two", "three"],
        }
        const { done } = await start(h, c)
        h.term.sendInput(" ") // grab cursor at index 0
        h.term.sendInput(ARROW_DOWN) // move "one" down
        h.term.sendInput(" ") // release
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("order")).toBe(
            JSON.stringify(["two", "one", "three"])
        )
    })
})

describe("cancellation", () => {
    it("escape on input prompt leaves the variable unset", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "input",
            name: "skip",
            message: "Skip?",
        }
        const { done } = await start(h, c)
        h.term.sendInput(ESC)
        await done
        expect(h.variables.has("skip")).toBe(false)
    })
})

describe("inline prompt layout", () => {
    it("renders the message and the editable buffer on a single row", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "input",
            name: "x",
            message: "Type:",
        }
        const { done } = await start(h, c)
        type(h, "abc")
        await flushRender(h.tui, h.term)
        const lines = await h.term.getViewport()
        const promptRow = lines.find((l) => l.includes("Type:")) ?? ""
        expect(promptRow).toContain("? Type:")
        expect(promptRow).toContain("abc")
        h.term.sendInput(ENTER)
        await done
    })
})

describe("answer line color", () => {
    it("submits with a leading ✔ glyph in the answer line", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "input",
            name: "color",
            message: "Color?",
        }
        const { done } = await start(h, c)
        type(h, "red")
        h.term.sendInput(ENTER)
        await done
        await flushRender(h.tui, h.term)
        const visible = (await h.term.getViewport()).join("\n")
        expect(visible).toContain("✔")
        expect(visible).toContain("red")
    })
})

describe("number prompt validation", () => {
    it("rejects non-numeric keystrokes so NaN cannot be submitted", async () => {
        const h = makeHarness()
        const c: Component = {
            component: "number",
            name: "n",
            message: "How many?",
        }
        const { done } = await start(h, c)
        type(h, "12abc34")
        h.term.sendInput(ENTER)
        await done
        expect(h.variables.get("n")).toBe("1234")
    })
})
