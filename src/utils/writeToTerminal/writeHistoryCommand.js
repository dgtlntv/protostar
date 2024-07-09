import { getCommandLinePrefix } from "../../config/commandLineConfig.js"
import { writeColoredText } from "./writeColoredText.js"

export default function writeHistoryCommand(term, command) {
    term.write("\x1b[2K\r")
    const prefix = getCommandLinePrefix()
    prefix.forEach((part) => {
        writeColoredText(term, part.text, part.color, true)
    })
    term.write(command)
}
