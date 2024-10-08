import Yargs from "yargs/browser"
import commandsToYargs from "./commandsToYargs"

export default function initializeYargs(localEcho, commandsData) {
    const yargs = Yargs().usageConfiguration({ "hide-types": true })
    commandsToYargs(yargs, commandsData, localEcho)

    return yargs
}
