export async function showProgressBar(term, text, duration) {
    const width = 20
    const frameDuration = 100
    const frames = duration / frameDuration

    for (let i = 0; i <= frames; i++) {
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
    term.write("\r\n")
}
