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

        // Get the text content from the terminal
        // We need to get the content of visible terminal rows
        const visibleText = await page.evaluate(() => {
            // Get all terminal lines
            const terminalLines = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            // Get text content of those lines that contain our input
            return terminalLines.map((line) => line.textContent).join("\n")
        })

        // Find the line with our prompt
        const expectedLine = `${promptString}${testInput} `
        const lines = visibleText.split("\n")
        const inputLine = lines.find((line) => line.includes(promptString))

        // Verify the terminal displays exactly the expected text
        expect(inputLine).toBe(expectedLine)
    })

    test("should handle special characters", async ({ page }) => {
        await page.click("#terminal")

        // Type special characters
        await page.keyboard.type("!@#$%^&*()")

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get text content
        const visibleText = await page.evaluate(() => {
            const terminalLines = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return terminalLines.map((line) => line.textContent).join("\n")
        })

        // Find the line with our prompt
        const expectedLine = `${promptString}!@#$%^&*() `
        const lines = visibleText.split("\n")
        const inputLine = lines.find((line) => line.includes(promptString))

        // Verify special characters are displayed exactly
        expect(inputLine).toBe(expectedLine)
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

        // Get text content
        const visibleText = await page.evaluate(() => {
            const terminalLines = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return terminalLines.map((line) => line.textContent).join("\n")
        })

        // Find the line with our prompt
        const expectedLine = `${promptString}testing navigated arrows`
        const lines = visibleText.split("\n")
        const inputLine = lines.find((line) => line.includes(promptString))

        // Verify the insertion happened at the correct position with exact match
        expect(inputLine).toBe(expectedLine)
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

        // Get text content
        const visibleText = await page.evaluate(() => {
            const terminalLines = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return terminalLines.map((line) => line.textContent).join("\n")
        })

        // Find the line with our prompt
        const expectedLine = `${promptString}typing mistake`
        const lines = visibleText.split("\n")
        const inputLine = lines.find((line) => line.includes(promptString))

        // Verify the correction was made with exact match
        expect(inputLine).toBe(expectedLine)
    })

    test("should handle line wrapping with long input", async ({ page }) => {
        await page.click("#terminal")

        // Type a very long string that should wrap based on terminal width
        const longString =
            "This is a very long string that should automatically wrap to the next line because it exceeds the width of the terminal display and the terminal should handle this properly by showing the text across multiple lines"
        await page.keyboard.type(longString)

        // Wait for rendering
        await page.waitForTimeout(100)

        // Get text content
        const visibleText = await page.evaluate(() => {
            const terminalLines = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return terminalLines.map((line) => line.textContent).join("\n")
        })

        // For wrapped text, we need a different approach - concatenate all lines
        // and check if they contain the full expected text in order
        const fullText = visibleText.replace(/\n/g, "")
        const expectedText = `${promptString}${longString}`

        // Verify the entire string was rendered correctly
        expect(fullText).toContain(expectedText)
    })
})
