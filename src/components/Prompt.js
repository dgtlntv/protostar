export async function handlePrompts(term, prompts) {
    const results = {}
    for (const prompt of prompts) {
        term.write(`${prompt.message} `)
        const input = await new Promise((resolve) => {
            let inputBuffer = ""
            term.onData((data) => {
                if (data === "\r") {
                    term.write("\r\n")
                    resolve(inputBuffer)
                } else if (data === "\u007F") {
                    // Backspace
                    if (inputBuffer.length > 0) {
                        inputBuffer = inputBuffer.slice(0, -1)
                        term.write("\b \b")
                    }
                } else {
                    inputBuffer += data
                    if (prompt.hidden) {
                        term.write("*")
                    } else {
                        term.write(data)
                    }
                }
            })
        })
        results[prompt.name] = input
    }
    return results
}
