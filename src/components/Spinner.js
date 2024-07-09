import { setInputDisabled, setCurrentOperation } from "./KeyboardHandler.js"

export async function showSpinner(term, text, duration, operation) {
    setInputDisabled(true)

    const spinnerFrames = ["|", "/", "-", "\\"]
    const frameDuration = 100
    const frames = duration / frameDuration

    try {
        for (let i = 0; i < frames; i++) {
            if (operation.isCancelled()) break
            const frame = spinnerFrames[i % spinnerFrames.length]
            term.write(`\r${text} ${frame}`)
            await new Promise((resolve) => setTimeout(resolve, frameDuration))
        }
    } finally {
        setInputDisabled(false)
    }
}
