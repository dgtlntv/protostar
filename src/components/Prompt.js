import { setUserPromptActive } from "./KeyboardHandler.js"

export async function handleUserPrompts(term, userPrompts) {
    const results = {}
    for (const userPrompt of userPrompts) {
        const result = await getUserInput(term, userPrompt)
        if (result === null) {
            return null
        }
        results[userPrompt.name] = result
    }
    return { prompt: results }
}

async function getUserInput(term, userPrompt) {
    return new Promise((resolve) => {
        const prefix = `${userPrompt.message} `
        term.write(prefix)
        const prefixLength = prefix.length
        let currentInput = ""
        let cursorPosition = 0

        function renderInput() {
            term.write("\r" + " ".repeat(term.cols))
            term.write("\r" + prefix)
            term.write(userPrompt.hidden ? "*".repeat(currentInput.length) : currentInput)
            term.write("\x1b[" + (prefixLength + cursorPosition + 1) + "G")
        }

        setUserPromptActive(true)
        const disposable = term.onKey(({ key, domEvent }) => {
            const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

            if (domEvent.ctrlKey && domEvent.key === "c") {
                term.write("\r\n")
                term.writeln("^C")
                disposable.dispose()
                setUserPromptActive(false)
                resolve(null)
                return
            }

            switch (domEvent.keyCode) {
                case 13: // Enter
                    term.write("\r\n")
                    disposable.dispose()
                    setUserPromptActive(false)
                    resolve(currentInput)
                    break
                case 8: // Backspace
                    if (cursorPosition > 0) {
                        currentInput = currentInput.slice(0, cursorPosition - 1) + currentInput.slice(cursorPosition)
                        cursorPosition--
                        renderInput()
                    }
                    break
                case 37: // Left arrow
                    if (cursorPosition > 0) {
                        cursorPosition--
                        renderInput()
                    }
                    break
                case 39: // Right arrow
                    if (cursorPosition < currentInput.length) {
                        cursorPosition++
                        renderInput()
                    }
                    break
                case 36: // Home
                    cursorPosition = 0
                    renderInput()
                    break
                case 35: // End
                    cursorPosition = currentInput.length
                    renderInput()
                    break
                default:
                    if (printable) {
                        currentInput = currentInput.slice(0, cursorPosition) + key + currentInput.slice(cursorPosition)
                        cursorPosition++
                        renderInput()
                    }
                    break
            }
        })
    })
}
