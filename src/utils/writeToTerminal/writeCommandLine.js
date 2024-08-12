import { getCommandLinePrefix } from "../../config/commandLineConfig"
import { getColoredText } from "./getColoredText"

export default function writeCommandLine(term) {
    term.write("\r")
    const prefix = getCommandLinePrefix()
    prefix.forEach((part) => {
        term.write(getColoredText(term, part.text, part.color))
    })
}
