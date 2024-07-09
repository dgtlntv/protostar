import writeCommandLine from "../utils/writeToTerminal/writeCommandLine.js"
import { getCommandLinePrefixLength } from "../config/commandLineConfig.js"
import { handleCommand } from "./CommandHandler.js"

// States
let commandHistory = []
let historyIndex = -1
let isUserPromptActive = false
let isInputDisabled = false
let currentOperation = null
let currentInput = ""
let cursorPosition = 0

// setStates
export function setInputDisabled(disabled) {
    isInputDisabled = disabled
}

export function setUserPromptActive(active) {
    isUserPromptActive = active
}

export function setCurrentOperation(operation) {
    currentOperation = operation
}

function renderInput(term) {
    const prefixLength = getCommandLinePrefixLength()
    term.write("\r" + " ".repeat(term.cols))
    writeCommandLine(term)
    term.write(currentInput)
    term.write("\x1b[" + (prefixLength + cursorPosition + 1) + "G")
}

export function setupKeyboardHandler(term) {
    term.attachCustomKeyEventHandler((event) => {
        if ((event.ctrlKey || event.metaKey) && event.code === "KeyV" && event.type === "keydown") {
            navigator.clipboard.readText().then((text) => {
                currentInput = currentInput.slice(0, cursorPosition) + text + currentInput.slice(cursorPosition)
                cursorPosition = cursorPosition + text.length
                renderInput(term)
            })
            return false
        }

        if ((event.ctrlKey || event.metaKey) && event.code === "KeyC" && event.type === "keydown") {
            const selection = term.getSelection()
            if (selection) {
                navigator.clipboard.writeText(selection)
                return false
            }
        }

        return true
    })

    term.onKey(({ key, domEvent }) => {
        if (isUserPromptActive) {
            return
        }

        if (isInputDisabled) {
            if (domEvent.ctrlKey && domEvent.key === "c") {
                term.write("\r\n")
                term.writeln("^C")
                if (currentOperation) {
                    currentOperation.cancel()
                }
                setInputDisabled(false)
                currentInput = ""
                cursorPosition = 0
            }
            return
        }

        const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

        switch (domEvent.keyCode) {
            case 13: // Enter
                if (currentInput.trim() !== "") {
                    commandHistory.unshift(currentInput)
                    historyIndex = -1
                    term.writeln("")
                    handleCommand(term, currentInput)
                } else {
                    term.writeln("")
                    writeCommandLine(term)
                }
                currentInput = ""
                cursorPosition = 0
                break

            case 8: // Backspace
                if (cursorPosition > 0) {
                    currentInput = currentInput.slice(0, cursorPosition - 1) + currentInput.slice(cursorPosition)
                    cursorPosition--
                    renderInput(term)
                }
                break

            case 37: // Left arrow
                if (cursorPosition > 0) {
                    cursorPosition--
                    renderInput(term)
                }
                break

            case 39: // Right arrow
                if (cursorPosition < currentInput.length) {
                    cursorPosition++
                    renderInput(term)
                }
                break

            case 38: // Up arrow
                if (historyIndex < commandHistory.length - 1) {
                    historyIndex++
                    currentInput = commandHistory[historyIndex]
                    cursorPosition = currentInput.length
                    renderInput(term)
                }
                break

            case 40: // Down arrow
                if (historyIndex > -1) {
                    historyIndex--
                    currentInput = historyIndex >= 0 ? commandHistory[historyIndex] : ""
                    cursorPosition = currentInput.length
                    renderInput(term)
                }
                break

            default:
                if (printable) {
                    currentInput = currentInput.slice(0, cursorPosition) + key + currentInput.slice(cursorPosition)
                    cursorPosition++
                    renderInput(term)
                }
                break
        }
    })
}
