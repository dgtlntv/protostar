import Yargs from "yargs/browser"
import commandsToYargs from "./commandsToYargs"

export default function initializeYargs(localEcho, commandsData) {
    const yargs = Yargs()
        .usageConfiguration({ "hide-types": true })
        .demandCommand(1, "You need to specify a command.")
        .strict()
        .fail((msg, err, yargs) => {
            localEcho.print(msg + "\n\n")
            yargs.showHelp()
        })

    commandsToYargs(yargs, commandsData, localEcho)

    return yargs
}