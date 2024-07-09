import { handleCommand } from "../commands/index.js"
import { writeCommandLine } from "./Terminal.js"
import { getCommandLinePrefixLength } from "../config/commandLineConfig.js"

let isUserPromptActive = false

export function setUserPromptActive(active) {
    isUserPromptActive = active
}

export function setupKeyboardHandler(term) {
    let commandHistory = []
    let historyIndex = -1

    term.attachCustomKeyEventHandler((event) => {
        if (isUserPromptActive || event.type !== "keydown") {
            return true
        }

        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
            handleArrowKeys(term, event.key, commandHistory, historyIndex)
            return false
        }

        return true
    })

    term.onKey(({ key, domEvent }) => {
        if (isUserPromptActive) {
            return
        }

        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

        if (domEvent.keyCode === 13) {
            // Enter
            const input = term.buffer.active.getLine(term.buffer.active.cursorY).translateToString().trim()
            term.write("\r\n")

            if (input !== "") {
                commandHistory.unshift(input)
                historyIndex = -1
                handleCommand(term, input)
            } else {
                writeCommandLine()
            }
        } else if (domEvent.keyCode === 8) {
            // Backspace
            if (term.buffer.active.cursorX > getCommandLinePrefixLength()) {
                term.write("\b \b")
            }
        } else if (printable) {
            term.write(key)
        }
    })
}

function handleArrowKeys(term, key, commandHistory, historyIndex) {
    const currentLine = term.buffer.active.getLine(term.buffer.active.cursorY).translateToString()
    const prefixLength = getCommandLinePrefixLength()

    switch (key) {
        case "ArrowUp":
            if (historyIndex < commandHistory.length - 1) {
                historyIndex++
                writeHistoryLine(term, commandHistory[historyIndex])
            }
            break
        case "ArrowDown":
            if (historyIndex > -1) {
                historyIndex--
                const newInput = historyIndex >= 0 ? commandHistory[historyIndex] : ""
                writeHistoryLine(term, newInput)
            }
            break
        case "ArrowLeft":
            if (term.buffer.active.cursorX > prefixLength) {
                term.write(key)
            }
            break
        case "ArrowRight":
            if (term.buffer.active.cursorX < currentLine.length) {
                term.write(key)
            }
            break
    }
}

function writeHistoryLine(term, input) {
    term.write("\x1b[2K\r")
    writeCommandLine()
    term.write(input)
}
