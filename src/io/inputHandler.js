import Yargs from "yargs/browser"
import stringArgv from "string-argv"
import getColoredText from "../utils/getColoredText.js"
import { COMMAND_LINE_PREFIX } from "../config/commandLineConfig.js"
import commandsData from "../commands.json"
import commandsToYarg from "./commandsToYarg.js"

export default function inputHandler(localEcho, term) {
    localEcho.read(getColoredText(COMMAND_LINE_PREFIX, true)).then((input) => {
        const argv = stringArgv(input)
        const yargs = Yargs().usageConfiguration({ "hide-types": true })

        commandsToYarg(yargs, commandsData, localEcho)
        yargs
            .parse(argv, function (err, argv, output) {
                if (output) localEcho.println(output)
            })
            .then(() => {
                inputHandler(localEcho, term)
            })
    })
}
