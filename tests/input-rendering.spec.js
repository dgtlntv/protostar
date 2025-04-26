import { expect, test } from "@playwright/test"
import { COMMAND_LINE_PREFIX } from "../src/config/commandLineConfig.js"

test.describe("Terminal Input Rendering", () => {
    const getPromptString = () => {
        return COMMAND_LINE_PREFIX.map((part) => part.text).join("")
    }

    const promptString = getPromptString()

    test.beforeEach(async ({ page }) => {
        // Navigate to the test page that includes our terminal
        await page.goto("/tests/terminal-test.html")

        // Wait for terminal to be fully initialized
        await page.waitForSelector("#terminal .xterm-screen")
    })

    test("should render typed characters to the terminal", async ({ page }) => {
        // Focus the terminal
        await page.click("#terminal")

        // Type some text
        const testInput = "hello world"
        await page.keyboard.type(testInput)

        // Wait for rendering to complete
        await page.waitForTimeout(100)

        // Get the text content from the terminal - specifically from the first row
        const visibleText = await page.evaluate(() => {
            // Get the first div (index 0) in xterm-rows
            const firstLine = document.querySelectorAll(".xterm-rows > div")[0]
            return firstLine ? firstLine.textContent.replace(/\s+$/, "") : ""
        })

        // Verify the terminal displays exactly the expected text
        expect(visibleText).toBe(`${promptString}${testInput}`)
    })

    test("should handle special characters", async ({ page }) => {
        await page.click("#terminal")

        // Type special characters
        await page.keyboard.type("!@#$%^&*()")

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get text content from the first row
        const visibleText = await page.evaluate(() => {
            const firstLine = document.querySelectorAll(".xterm-rows > div")[0]
            return firstLine ? firstLine.textContent.replace(/\s+$/, "") : ""
        })

        // Verify special characters are displayed exactly
        expect(visibleText).toBe(`${promptString}!@#$%^&*()`)
    })

    test("should handle arrow key navigation", async ({ page }) => {
        await page.click("#terminal")

        // Type text
        await page.keyboard.type("testing arrows")

        // Use left arrow to move cursor back
        for (let i = 0; i < 6; i++) {
            await page.keyboard.press("ArrowLeft")
        }

        // Type at the new cursor position
        await page.keyboard.type("navigated ")

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get text content from the first row
        const visibleText = await page.evaluate(() => {
            const firstLine = document.querySelectorAll(".xterm-rows > div")[0]
            return firstLine ? firstLine.textContent.replace(/\s+$/, "") : ""
        })

        // Verify the insertion happened at the correct position with exact match
        expect(visibleText).toBe(`${promptString}testing navigated arrows`)
    })

    test("should handle backspace", async ({ page }) => {
        await page.click("#terminal")

        // Type text with a mistake
        await page.keyboard.type("typign mistake")

        // Use left arrow to position cursor at the mistake
        for (let i = 0; i < 8; i++) {
            await page.keyboard.press("ArrowLeft")
        }

        // Delete the mistake
        for (let i = 0; i < 2; i++) {
            await page.keyboard.press("Backspace")
        }

        // Type the correct letter
        await page.keyboard.type("ng")

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get text content from the first row
        const visibleText = await page.evaluate(() => {
            const firstLine = document.querySelectorAll(".xterm-rows > div")[0]
            return firstLine ? firstLine.textContent.replace(/\s+$/, "") : ""
        })

        // Verify the correction was made with exact match
        expect(visibleText).toBe(`${promptString}typing mistake`)
    })

    test("should handle line wrapping with long input", async ({ page }) => {
        await page.click("#terminal")

        // Type a very long string that should wrap based on terminal width
        const longString =
            "This is a very long string that should automatically wrap to the next line because it exceeds the width of the terminal display and the terminal should handle this properly by showing the text across multiple lines"
        await page.keyboard.type(longString)

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get all terminal row elements as individual lines
        const terminalLines = await page.evaluate(() => {
            const rows = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return rows.map((line) => line.textContent.replace(/\s+$/, ""))
        })

        // Verify we have multiple lines (text should wrap)
        expect(terminalLines.length).toBeGreaterThan(1)

        expect(terminalLines[0]).toBe(
            `${promptString}This is a very long string that should automatically wrap to t`
        )
        expect(terminalLines[1]).toBe(
            "he next line because it exceeds the width of the terminal display and the ter"
        )
        expect(terminalLines[2]).toBe(
            "minal should handle this properly by showing the text across multiple lines"
        )
    })

    test("should handle multiline navigation with arrow keys", async ({
        page,
    }) => {
        await page.click("#terminal")

        // Type a long string that wraps to multiple lines
        const longString =
            "This is a multiline input test. We need to check if arrow navigation works correctly across line boundaries. The cursor should move up and down as expected."
        await page.keyboard.type(longString)

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get current terminal state before navigation
        const initialLines = await page.evaluate(() => {
            const rows = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return rows.map((line) => line.textContent.replace(/\s+$/, ""))
        })

        // Navigate cursor to middle of second line
        // First, go to start of input
        for (let i = 0; i < longString.length; i++) {
            await page.keyboard.press("ArrowLeft")
        }

        // Then, move forward to position in the second line (approximate position)
        for (let i = 0; i < 77; i++) {
            await page.keyboard.press("ArrowRight")
        }

        // Insert new text at this position
        await page.keyboard.type("[INSERTED] ")

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get updated terminal lines
        const updatedLines = await page.evaluate(() => {
            const rows = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return rows.map((line) => line.textContent.replace(/\s+$/, ""))
        })

        // Verify insertion in correct position (should be in second line)
        expect(updatedLines[1]).toContain("[INSERTED]")

        // Verify the text after the insertion point shifted correctly
        expect(updatedLines.join("")).toContain(
            "works correctly [INSERTED] across line boundaries."
        )
    })

    test("should handle deletion across line boundaries", async ({ page }) => {
        await page.click("#terminal")

        // Type a long string that wraps to multiple lines
        const longString =
            "This text will wrap across multiple lines. We want to test if deleting characters across line boundaries works correctly."
        await page.keyboard.type(longString)

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get current terminal state before deletion
        const initialLines = await page.evaluate(() => {
            const rows = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return rows.map((line) => line.textContent.replace(/\s+$/, ""))
        })

        for (let i = 0; i < 52; i++) {
            await page.keyboard.press("ArrowLeft")
        }

        // Delete characters across the line boundary
        for (let i = 0; i < 12; i++) {
            // +1 for the space
            await page.keyboard.press("Backspace")
        }

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get updated terminal lines
        const updatedLines = await page.evaluate(() => {
            const rows = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return rows.map((line) => line.textContent.replace(/\s+$/, ""))
        })

        // Verify the word was deleted and the text reflowed correctly
        const joinedText = updatedLines.join("")
        expect(joinedText).not.toContain("if deleting")
        expect(joinedText).toBe(
            `${promptString}This text will wrap across multiple lines. We want to test characters across line boundaries works correctly.`
        )
    })
})
