import { test, expect } from "@playwright/test"

test("terminal boots and renders the prompt", async ({ page }) => {
    await page.goto("/")

    // The xterm.js terminal renders rows into `.xterm-rows`. The prompt
    // banner `user@ubuntu:~$` appears once LocalEchoController has attached
    // and `read()` has been called. Poll the DOM for it.
    await expect
        .poll(
            async () =>
                page.evaluate(() => {
                    const rows = document.querySelector(".xterm-rows")
                    return rows?.textContent ?? ""
                }),
            { timeout: 10_000 }
        )
        .toContain("user@ubuntu:~$")
})
