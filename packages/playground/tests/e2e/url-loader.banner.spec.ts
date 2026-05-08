/**
 * @file Trust-banner contract for URL-loaded prototypes. The banner is a
 * property of the boot mode, not of decode success — a recipient who
 * follows a malformed share link is the case most in need of the framing,
 * so a hash boot always shows it. The bundled-demo path is trusted local
 * content and stays unchrome'd.
 *
 * Also exercises the dismiss round-trip through `sessionStorage`: once
 * dismissed the banner stays hidden across reloads in the same tab, and
 * a fresh browser context (new tab) opens with the full bar back.
 */

import { expect, test } from "@playwright/test"
import { waitForPrompt } from "./helpers/terminal"

const BANNER_TEXT =
    "This is a prototype, not a real terminal. Don't enter real credentials."

const SYNTHETIC_COMMANDS = {
    welcome: "Synthetic prototype loaded from URL hash.",
    variables: {},
    commands: {
        greet: {
            description: "Print a greeting.",
            handler: { component: "text", output: "hello" },
        },
    },
}

/**
 * Encode the synthetic commands inside the page so the bytes match what
 * the production share shortcut would write — same browser, same
 * `CompressionStream`, no Node-side fork to drift from.
 */
async function encodeSyntheticPayload(
    page: import("@playwright/test").Page
): Promise<string> {
    await page.goto("/")
    await waitForPrompt(page)
    return page.evaluate(
        async (commands) => window.__protostar.codec.encode(commands),
        SYNTHETIC_COMMANDS
    )
}

test.describe("url-loader prototype banner", () => {
    test("no-hash boot does not render the banner", async ({ page }) => {
        await page.goto("/")
        await waitForPrompt(page)

        await expect(page.locator("#prototype-banner")).toHaveCount(0)
    })

    test("valid hash boot renders the banner with the documented text", async ({
        page,
    }) => {
        const payload = await encodeSyntheticPayload(page)

        await page.goto(`/#${payload}`)
        await page.reload()
        await waitForPrompt(page)

        const banner = page.locator("#prototype-banner")
        await expect(banner).toHaveCount(1)
        await expect(banner).toBeVisible()
        await expect(banner).toContainText(BANNER_TEXT)
    })

    test("malformed hash still renders the banner", async ({ page }) => {
        // Decode failure is exactly the case where a recipient most needs
        // the trust framing — a broken link from an untrusted source.
        await page.goto("/#p1=garbage_payload_not_base64url_compressed")
        await waitForPrompt(page)

        const banner = page.locator("#prototype-banner")
        await expect(banner).toHaveCount(1)
        await expect(banner).toContainText(BANNER_TEXT)
    })

    test("dismiss hides the banner and persists across reloads in the same tab", async ({
        page,
    }) => {
        const payload = await encodeSyntheticPayload(page)

        await page.goto(`/#${payload}`)
        await page.reload()
        await waitForPrompt(page)

        const banner = page.locator("#prototype-banner")
        await expect(banner).toBeVisible()

        await banner.locator(".prototype-banner-dismiss").click()
        await expect(banner).toBeHidden()

        // Reloading the same tab must keep the dismissed state — that's
        // the contract for `sessionStorage`.
        await page.reload()
        await waitForPrompt(page)
        await expect(page.locator("#prototype-banner")).toBeHidden()
    })

    test("a fresh tab opens with the banner visible again", async ({ browser }) => {
        // `sessionStorage` is per-context; spawning a new context is
        // the e2e analogue of opening a brand-new browser tab.
        const firstContext = await browser.newContext()
        const firstPage = await firstContext.newPage()
        const payload = await encodeSyntheticPayload(firstPage)
        await firstPage.goto(`/#${payload}`)
        await firstPage.reload()
        await waitForPrompt(firstPage)
        await firstPage
            .locator("#prototype-banner .prototype-banner-dismiss")
            .click()
        await expect(firstPage.locator("#prototype-banner")).toBeHidden()
        await firstContext.close()

        const secondContext = await browser.newContext()
        const secondPage = await secondContext.newPage()
        await secondPage.goto(`/#${payload}`)
        await waitForPrompt(secondPage)
        await expect(secondPage.locator("#prototype-banner")).toBeVisible()
        await secondContext.close()
    })
})
