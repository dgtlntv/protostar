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
        term.write(`${userPrompt.message} `)
        let inputBuffer = ""
        let cursorOffset = 0

        setUserPromptActive(true)

        const disposable = term.onKey(({ key, domEvent }) => {
            const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

            if (domEvent.keyCode === 13) {
                // Enter
                term.write("\r\n")
                disposable.dispose()
                setUserPromptActive(false)
                resolve(inputBuffer)
            } else if (domEvent.keyCode === 8) {
                // Backspace
                if (cursorOffset > 0) {
                    inputBuffer = inputBuffer.slice(0, -cursorOffset - 1) + inputBuffer.slice(-cursorOffset)
                    cursorOffset = Math.max(0, cursorOffset - 1)
                    rewriteInput(term, userPrompt, inputBuffer, cursorOffset)
                }
            } else if (domEvent.keyCode === 37) {
                // Left arrow
                if (cursorOffset < inputBuffer.length) {
                    cursorOffset++
                    term.write(key)
                }
            } else if (domEvent.keyCode === 39) {
                // Right arrow
                if (cursorOffset > 0) {
                    cursorOffset--
                    term.write(key)
                }
            } else if (printable) {
                inputBuffer = inputBuffer.slice(0, -cursorOffset) + key + inputBuffer.slice(-cursorOffset)
                rewriteInput(term, userPrompt, inputBuffer, cursorOffset)
            }
        })
    })
}

function rewriteInput(term, userPrompt, input, cursorOffset) {
    const displayInput = userPrompt.hidden ? "*".repeat(input.length) : input
    term.write("\x1b[2K\r")
    term.write(`${userPrompt.message} ${displayInput}`)
    if (cursorOffset > 0) {
        term.write(`\x1b[${cursorOffset}D`)
    }
}
