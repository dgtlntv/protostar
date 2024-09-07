import stringArgv from "string-argv"
import getColoredText from "../utils/getColoredText.js"
import { COMMAND_LINE_PREFIX } from "../config/commandLineConfig.js"
import chalk from "chalk"

export default function inputHandler(localEcho, term, yargs) {
    localEcho.read(getColoredText(COMMAND_LINE_PREFIX, true)).then((input) => {
        const argv = stringArgv(input)

        yargs
            .demandCommand(1, "You need to specify a command.")
            .strict()
            .fail((msg, err, yargs) => {
                localEcho.print(chalk.redBright(msg + "\n\n"))
                yargs.showHelp()
            })
            .parse(argv, function (err, argv, output) {
                if (output) localEcho.println(output)
                inputHandler(localEcho, term, yargs)
            })
    })
}
