import { expect, test } from "@playwright/test"
import { COMMAND_LINE_PREFIX } from "../src/config/commandLineConfig.js"

test.describe("Terminal Cursor Constraints", () => {
    const getPromptString = () => {
        return COMMAND_LINE_PREFIX.map((part) => part.text).join("")
    }

    const promptString = getPromptString()

    test.beforeEach(async ({ page }) => {
        // Navigate to the test page that includes our terminal
        await page.goto("/tests/terminal-test.html")

        // Wait for terminal to be fully initialized
        await page.waitForSelector("#terminal .xterm-screen")

        // Focus the terminal
        await page.click("#terminal")
    })

    // Helper function to get the character that currently has the cursor
    const getCursorCharacter = async (page) => {
        return page.evaluate(() => {
            const cursorElement = document.querySelector(".xterm-cursor")
            return cursorElement ? cursorElement.textContent : null
        })
    }

    // Helper function to get the text content of the element containing the cursor
    const getCursorElementTextContent = async (page) => {
        return page.evaluate(() => {
            const cursorElement = document.querySelector(".xterm-cursor")
            if (!cursorElement) return null

            // Get the parent span that contains the cursor
            const parentSpan = cursorElement.parentElement
            return parentSpan ? parentSpan.textContent : null
        })
    }

    test("should prevent cursor from moving beyond the prompt", async ({
        page,
    }) => {
        // Type some text
        await page.keyboard.type("test cursor")
        await page.waitForTimeout(100)

        // Move cursor to the beginning of input
        for (let i = 0; i < "test cursor".length; i++) {
            await page.keyboard.press("ArrowLeft")
        }

        await page.waitForTimeout(100)
        // Check cursor is at the first character of input
        let cursorChar = await getCursorCharacter(page)
        expect(cursorChar).toBe("t") // Should be on the 't' of "test"

        // Try to move cursor further left (into prompt)
        for (let i = 0; i < promptString.length; i++) {
            await page.keyboard.press("ArrowLeft")
        }

        // Check cursor is still at the first character of input (not in prompt)
        cursorChar = await getCursorCharacter(page)
        expect(cursorChar).toBe("t") // Should still be on the 't' of "test"

        // Type at cursor position - should insert at beginning of input, not in prompt
        await page.keyboard.type("new ")
        await page.waitForTimeout(100)

        // Check new text appears after prompt but before original input
        const visibleText = await page.evaluate(() => {
            const firstLine = document.querySelectorAll(".xterm-rows > div")[0]
            return firstLine ? firstLine.textContent.replace(/\\s+$/, "") : ""
        })

        expect(visibleText).toBe(`${promptString}new test cursor`)
    })

    test("should prevent cursor from moving beyond the end of input", async ({
        page,
    }) => {
        // Type some text
        await page.keyboard.type("end test")
        await page.waitForTimeout(100)

        // Get cursor character at the end of input (should be null or empty as cursor is after the text)
        let cursorChar = await getCursorCharacter(page)

        // Try to move cursor beyond the end of input
        for (let i = 0; i < 10; i++) {
            await page.keyboard.press("ArrowRight")
        }

        // Type at cursor position - should append to existing input
        await page.keyboard.type(" appended")
        await page.waitForTimeout(100)

        // Check new text appears at the end
        const visibleText = await page.evaluate(() => {
            const firstLine = document.querySelectorAll(".xterm-rows > div")[0]
            return firstLine ? firstLine.textContent.replace(/\\s+$/, "") : ""
        })

        expect(visibleText.trim()).toBe(`${promptString}end test appended`)
    })

    test("should not allow deleting the prompt", async ({ page }) => {
        // Type some text
        await page.keyboard.type("try delete prompt")
        await page.waitForTimeout(100)

        // Move cursor to beginning of input
        for (let i = 0; i < "try delete prompt".length; i++) {
            await page.keyboard.press("ArrowLeft")
        }

        // Try to delete prompt by pressing backspace multiple times
        for (let i = 0; i < promptString.length + 5; i++) {
            await page.keyboard.press("Backspace")
        }

        // Check prompt is still intact
        const visibleText = await page.evaluate(() => {
            const firstLine = document.querySelectorAll(".xterm-rows > div")[0]
            return firstLine ? firstLine.textContent.replace(/\\s+$/, "") : ""
        })

        // Prompt should be intact, text might be deleted
        expect(visibleText.startsWith(promptString)).toBe(true)

        // Type to verify cursor position is correct
        await page.keyboard.type("after prompt ")
        await page.waitForTimeout(100)

        const newText = await page.evaluate(() => {
            const firstLine = document.querySelectorAll(".xterm-rows > div")[0]
            return firstLine ? firstLine.textContent.replace(/\\s+$/, "") : ""
        })

        expect(newText).toBe(`${promptString}after prompt try delete prompt`)
    })
})
