import Yargs from "yargs/browser"
import stringArgv from "string-argv"
import getColoredText from "../utils/getColoredText.js"
import { COMMAND_LINE_PREFIX } from "../config/commandLineConfig.js"
import commandsData from "../commands.json"
import commandsToYarg from "./commandsToYarg.js"
import chalk from "chalk"

export default function inputHandler(localEcho, term) {
    localEcho.read(getColoredText(COMMAND_LINE_PREFIX, true)).then((input) => {
        const argv = stringArgv(input)
        const yargs = Yargs().usageConfiguration({ "hide-types": true })

        commandsToYarg(yargs, commandsData, localEcho)

        yargs
            .demandCommand(1, "You need to specify a command.")
            .strict()
            .fail((msg, err, yargs) => {
                localEcho.print(chalk.redBright(msg + "\n\n"))
                yargs.showHelp()
            })
            .parse(argv, function (err, argv, output) {
                if (output) localEcho.println(output)
                inputHandler(localEcho, term)
            })
    })
}
