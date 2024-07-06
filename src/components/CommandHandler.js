import { writePrompt } from "./Terminal.js"
import { clearCommand } from "../commands/clearCommand.js"
import { helpCommand } from "../commands/helpCommand.js"
import { executeCustomCommand } from "../commands/customCommands.js"

export async function handleCommand(term, cmd) {
    const args = cmd.trim().split(/\s+/)
    const command = args[0].toLowerCase()
    const restArgs = args.slice(1)

    if (command === "clear") {
        clearCommand(term)
    } else if (command === "help") {
        helpCommand(term)
    } else {
        await executeCustomCommand(term, command, restArgs)
    }
    writePrompt()
}
