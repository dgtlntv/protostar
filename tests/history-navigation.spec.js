import { expect, test } from "@playwright/test"
import { COMMAND_LINE_PREFIX } from "../src/config/commandLineConfig.js"

test.describe("Command History Navigation", () => {
    const getPromptString = () => {
        return COMMAND_LINE_PREFIX.map((part) => part.text).join("")
    }

    const promptString = getPromptString()

    test.beforeEach(async ({ page }) => {
        // Navigate to the test page that includes our terminal
        // This also resets the history since it's a fresh page load
        await page.goto("/tests/terminal-test.html")

        // Wait for terminal to be fully initialized
        await page.waitForSelector("#terminal .xterm-screen")

        // Focus the terminal
        await page.click("#terminal")
    })

    // Helper function to get the terminal lines
    const getTerminalLines = async (page) => {
        return page.evaluate(() => {
            const lines = Array.from(
                document.querySelectorAll(".xterm-rows > div")
            )
            return lines.map((line) => line.textContent.replace(/\s+$/, ""))
        })
    }

    const getLastVisibleCommandLine = async (page) => {
        const lines = await getTerminalLines(page)

        // Find the last line with the prompt
        for (let i = lines.length - 1; i >= 0; i--) {
            // Trim any trailing spaces for comparison
            if (
                lines[i].trim() === promptString.trim() ||
                lines[i].startsWith(promptString)
            ) {
                return lines[i]
            }
        }
        return ""
    }

    test("should navigate through command history with arrow keys", async ({
        page,
    }) => {
        // Enter first command
        await page.keyboard.type("test1")
        await page.keyboard.press("Enter")
        await page.waitForTimeout(300) // Wait for command to execute

        // Enter second command
        await page.keyboard.type("test2")
        await page.keyboard.press("Enter")
        await page.waitForTimeout(300)

        // Enter third command
        await page.keyboard.type("test3")
        await page.keyboard.press("Enter")
        await page.waitForTimeout(300)

        // Press arrow up to get the last command
        await page.keyboard.press("ArrowUp")
        await page.waitForTimeout(300)
        let commandLine = await getLastVisibleCommandLine(page)
        expect(commandLine).toBe(`${promptString}test3`)

        // Press arrow up again to get the second command
        await page.keyboard.press("ArrowUp")
        await page.waitForTimeout(300)
        commandLine = await getLastVisibleCommandLine(page)
        expect(commandLine).toBe(`${promptString}test2`)

        // Press arrow up again to get the first command
        await page.keyboard.press("ArrowUp")
        await page.waitForTimeout(300)
        commandLine = await getLastVisibleCommandLine(page)
        expect(commandLine).toBe(`${promptString}test1`)

        // Press arrow down to navigate forward in history
        await page.keyboard.press("ArrowDown")
        await page.waitForTimeout(300)
        commandLine = await getLastVisibleCommandLine(page)
        expect(commandLine).toBe(`${promptString}test2`)

        // Press arrow down again to get to the last command
        await page.keyboard.press("ArrowDown")
        await page.waitForTimeout(300)
        commandLine = await getLastVisibleCommandLine(page)
        expect(commandLine).toBe(`${promptString}test3`)

        // Press arrow down again to get an empty command line
        await page.keyboard.press("ArrowDown")
        await page.waitForTimeout(300)
        commandLine = await getLastVisibleCommandLine(page)
        expect(commandLine).toBe(promptString.trim())
    })

    test("should execute commands from history correctly", async ({ page }) => {
        // Enter test commands
        await page.keyboard.type("test1")
        await page.keyboard.press("Enter")
        await page.waitForTimeout(300)

        await page.keyboard.type("test2")
        await page.keyboard.press("Enter")
        await page.waitForTimeout(300)

        // Verify the test outputs are visible
        let terminalText = await getTerminalLines(page)
        let joinedText = terminalText.join(" ")

        expect(joinedText).toContain("First test command executed!")
        expect(joinedText).toContain("Second test command executed!")

        // Access a command from history and execute it again
        await page.keyboard.press("ArrowUp") // Should show test2
        await page.keyboard.press("Enter")
        await page.waitForTimeout(300)

        // Check that the command was executed again
        terminalText = await getTerminalLines(page)
        joinedText = terminalText.join(" ")

        // Count occurrences of command output
        const matches = joinedText.match(/Second test command executed!/g) || []
        expect(matches.length).toBe(2) // Should appear twice now
    })

    test("should handle command modification from history", async ({
        page,
    }) => {
        // Enter a base command
        await page.keyboard.type("echo original")
        await page.keyboard.press("Enter")
        await page.waitForTimeout(300)

        // Get command from history and modify it
        await page.keyboard.press("ArrowUp")

        // Clear part of the command using backspace
        for (let i = 0; i < "original".length; i++) {
            await page.keyboard.press("Backspace")
        }

        // Type a new ending
        await page.keyboard.type("modified")
        await page.keyboard.press("Enter")
        await page.waitForTimeout(300)

        // Verify both commands were executed correctly
        const terminalText = await getTerminalLines(page)
        const joinedText = terminalText.join(" ")

        expect(joinedText).toContain("original") // From first command
        expect(joinedText).toContain("modified") // From modified command
    })
})
