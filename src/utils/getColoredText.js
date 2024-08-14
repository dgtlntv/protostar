import chalk from "chalk"

export default function getColoredText(textArray, noNewLine = false) {
    return textArray
        .map((item, index) => {
            const coloredText = item.color ? chalk[item.color](item.text) : item.text
            return index > 0 && !noNewLine ? "\n" + coloredText : coloredText
        })
        .join("")
}
