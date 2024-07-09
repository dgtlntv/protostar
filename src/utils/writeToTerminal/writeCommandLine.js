import { getCommandLinePrefix } from "../../config/commandLineConfig"
import { writeColoredText } from "./writeColoredText"

export default function writeCommandLine(term) {
    term.write("\r")
    const prefix = getCommandLinePrefix()
    prefix.forEach((part) => {
        writeColoredText(term, part.text, part.color)
    })
}
