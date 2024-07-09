export function writeColoredText(term, text, color, noNewLine = false) {
    const colorCodes = {
        black: "\x1b[30m",
        red: "\x1b[31m",
        green: "\x1b[32m",
        yellow: "\x1b[33m",
        blue: "\x1b[34m",
        magenta: "\x1b[35m",
        cyan: "\x1b[36m",
        white: "\x1b[37m",
    }
    const colorCode = color && colorCodes[color] ? colorCodes[color] : ""
    const resetCode = colorCode ? "\x1b[0m" : ""

    const lines = text.split("\n")
    for (let i = 0; i < lines.length; i++) {
        if (i > 0 && !noNewLine) term.write("\r\n")
        term.write(`${colorCode}${lines[i]}${resetCode}`)
    }
}
