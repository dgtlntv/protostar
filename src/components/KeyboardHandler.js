import { handleCommand } from "../commands/index.js"
import { writePrompt } from "./Terminal.js"

export function setupKeyboardHandler(term) {
    let input = ""
    let commandHistory = []
    let historyIndex = -1
    let cursorPosition = 0

    term.onKey(({ key, domEvent }) => {
        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

        if (domEvent.keyCode === 13) {
            // Enter key
            term.writeln("")
            if (input.trim() !== "") {
                commandHistory.unshift(input)
                historyIndex = -1
            }
            handleCommand(term, input)
            input = ""
            cursorPosition = 0
        } else if (domEvent.keyCode === 8) {
            // Backspace
            if (cursorPosition > 0) {
                input = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition)
                cursorPosition--
                term.write("\b \b")
                term.write(input.slice(cursorPosition))
                term.write("\x1b[K")
                term.write("\x1b[" + (input.length - cursorPosition) + "D")
            }
        } else if (domEvent.keyCode === 37) {
            // Left arrow
            if (cursorPosition > 0) {
                cursorPosition--
                term.write(key)
            }
        } else if (domEvent.keyCode === 39) {
            // Right arrow
            if (cursorPosition < input.length) {
                cursorPosition++
                term.write(key)
            }
        } else if (domEvent.keyCode === 38) {
            // Up arrow
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++
                input = commandHistory[historyIndex]
                term.write("\x1b[2K\r")
                writePrompt()
                term.write(input)
                cursorPosition = input.length
            }
        } else if (domEvent.keyCode === 40) {
            // Down arrow
            if (historyIndex > -1) {
                historyIndex--
                if (historyIndex === -1) {
                    input = ""
                } else {
                    input = commandHistory[historyIndex]
                }
                term.write("\x1b[2K\r")
                writePrompt()
                term.write(input)
                cursorPosition = input.length
            }
        } else if (printable) {
            input = input.slice(0, cursorPosition) + key + input.slice(cursorPosition)
            cursorPosition++
            term.write(key)
            if (cursorPosition < input.length) {
                term.write(input.slice(cursorPosition))
                term.write("\x1b[" + (input.length - cursorPosition) + "D")
            }
        }
    })
}
