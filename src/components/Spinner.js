import { setInputDisabled, setCurrentOperation } from "./KeyboardHandler.js"

export async function showSpinner(term, texts, duration, operation) {
    setInputDisabled(true)

    const spinnerFrames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
    const frameDuration = 80
    const frames = duration / frameDuration

    const totalTexts = texts.length
    const framesPerText = Math.floor(frames / totalTexts)

    try {
        for (let textIndex = 0; textIndex < totalTexts; textIndex++) {
            const text = texts[textIndex]
            for (let i = 0; i < framesPerText; i++) {
                if (operation.isCancelled()) return

                const frame = spinnerFrames[i % spinnerFrames.length]
                const output = `\r\x1b[K${frame}  ${text}` // Clear line and add padding
                term.write(output)
                await new Promise((resolve) => setTimeout(resolve, frameDuration))
            }
        }
    } finally {
        setInputDisabled(false)
        term.write("\r\x1b[K") // Clear line and move to next line
    }
}
