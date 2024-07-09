import handleBackspace from "../utils/keyboard/handleBackspace.js"
import handleArrowLeft from "../utils/keyboard/handleArrowLeft.js"
import handleArrowRight from "../utils/keyboard/handleArrowRight.js"
import { setUserPromptActive } from "./KeyboardHandler.js"

export async function handleUserPrompts(term, userPrompts) {
    const results = {}
    for (const userPrompt of userPrompts) {
        results[userPrompt.name] = await getUserInput(term, userPrompt)
    }
    return results
}

async function getUserInput(term, userPrompt) {
    return new Promise((resolve) => {
        const prefix = `${userPrompt.message} `
        term.write(prefix)
        const prefixLength = prefix.length

        setUserPromptActive(true)

        const disposable = term.onKey(({ key, domEvent }) => {
            const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey
            const currentLine = term.buffer.active.getLine(term.buffer.active.cursorY)
            const lineLength = currentLine.length

            switch (domEvent.keyCode) {
                case 13: // Enter
                    const input = currentLine.translateToString().slice(prefixLength).trim()
                    term.write("\r\n")
                    term.write("\r")
                    disposable.dispose()
                    setUserPromptActive(false)
                    resolve(input)
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

                default:
                    if (printable) {
                        term.write(userPrompt.hidden ? "*" : key)
                    }
                    break
            }
        })
    })
}
