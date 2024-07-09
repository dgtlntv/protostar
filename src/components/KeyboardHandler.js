import handleBackspace from "../utils/keyboard/handleBackspace.js"
import handleArrowLeft from "../utils/keyboard/handleArrowLeft.js"
import handleArrowRight from "../utils/keyboard/handleArrowRight.js"
import handleArrowUp from "../utils/keyboard/handleArrowUp.js"
import handleArrowDown from "../utils/keyboard/handleArrowDown.js"
import writeCommandLine from "../utils/writeToTerminal/writeCommandLine.js"
import { getCommandLinePrefixLength } from "../config/commandLineConfig.js"
import { handleCommand } from "../commands/index.js"

let commandHistory = []
let historyIndex = -1
let isUserPromptActive = false

export function setUserPromptActive(active) {
    isUserPromptActive = active
}

export function setupKeyboardHandler(term) {
    term.onKey(({ key, domEvent }) => {
        if (isUserPromptActive) {
            return
        }

        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey
        const prefixLength = getCommandLinePrefixLength()
        const currentLine = term.buffer.active.getLine(term.buffer.active.cursorY)
        const lineLength = currentLine.length

        switch (domEvent.keyCode) {
            case 13: // Enter
                const input = currentLine.translateToString().slice(prefixLength).trim()
                term.write("\r\n")

                if (input !== "") {
                    commandHistory.unshift(input)
                    historyIndex = -1
                    handleCommand(term, input)
                } else {
                    writeCommandLine(term)
                }
                break

            case 8: // Backspace
                handleBackspace(term, term.buffer.active.cursorX, prefixLength)
                break

            case 37: // Left arrow
                handleArrowLeft(term, term.buffer.active.cursorX, prefixLength)
                break

            case 39: // Right arrow
                handleArrowRight(term, term.buffer.active.cursorX, lineLength)
                break

            case 38: // Up arrow
                historyIndex = handleArrowUp(term, historyIndex, commandHistory, prefixLength)
                break

            case 40: // Down arrow
                historyIndex = handleArrowDown(term, historyIndex, commandHistory, prefixLength)
                break

            default:
                if (printable) {
                    term.write(key)
                }
                break
        }
    })
}
