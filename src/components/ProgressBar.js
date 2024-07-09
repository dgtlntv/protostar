import { setInputDisabled, setCurrentOperation } from "./KeyboardHandler.js"

export async function showProgressBar(term, text, duration, operation) {
    setInputDisabled(true)

    const width = 50
    const frameDuration = 100
    const frames = duration / frameDuration

    try {
        for (let i = 0; i <= frames; i++) {
            if (operation.isCancelled()) break
            const progress = i / frames
            const filled = Math.round(width * progress)
            const empty = width - filled
            const bar = `[${"=".repeat(filled)}${" ".repeat(empty)}]`
            const percentage = Math.round(progress * 100)

            term.write(`\r${text} ${bar} ${percentage}%`)

            if (i < frames) {
                await new Promise((resolve) => setTimeout(resolve, frameDuration))
            }
        }
    } finally {
        setInputDisabled(false)
    }
}
