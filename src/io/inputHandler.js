import Yargs from "yargs/browser"
import stringArgv from "string-argv"
import getColoredText from "../utils/writeToTerminal/getColoredText.js"
import { COMMAND_LINE_PREFIX } from "../config/commandLineConfig.js"
import commandsData from "../commands.json"
import commandsToYarg from "./commandsToYarg.js"

export default function inputHandler(localEcho, term) {
    localEcho.read(getColoredText(COMMAND_LINE_PREFIX, true)).then((input) => {
        // 1. Parse the string into args
        // 2. Take first entry in args array, remove it from args array, it is the command
        // 3. Check this command against all the commands we have. If exists continue, else throw error
        // 4. Get yargs spec for that command
        // 5. Execute action for command with the parsed yargs

        const argv = stringArgv(input)

        const yargs = Yargs()
        yargs.usageConfiguration({ "hide-types": true })
        commandsToYarg(yargs, commandsData)
        const parsedArgs = yargs.parse(argv, function (err, argv, output) {
            if (output) term.write(output)
            console.log(output)
        })
        console.log(parsedArgs)
        term.write(input)
        term.write("\r\n")
        inputHandler(localEcho, term)
    })
}
