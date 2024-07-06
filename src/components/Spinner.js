export async function showSpinner(term, text, duration) {
    const spinnerFrames = ["|", "/", "-", "\\"]
    const frameDuration = 100
    const frames = duration / frameDuration

    for (let i = 0; i < frames; i++) {
        const frame = spinnerFrames[i % spinnerFrames.length]
        term.write(`\r${text} ${frame}`)
        await new Promise((resolve) => setTimeout(resolve, frameDuration))
    }
    term.write("\r\n")
}
