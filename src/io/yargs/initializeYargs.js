import Yargs from "yargs/browser"
import commandsData from "../../commands.json"
import commandsToYargs from "./commandsToYargs"

export default function initializeYargs(localEcho) {
    const yargs = Yargs().usageConfiguration({ "hide-types": true })
    commandsToYargs(yargs, commandsData, localEcho)

    return yargs
}
