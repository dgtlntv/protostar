import writeCommandLine from "../utils/writeToTerminal/writeCommandLine.js"
import { clearCommand } from "../commands/clearCommand.js"
import { helpCommand } from "../commands/helpCommand.js"
import { executeCustomCommand } from "../commands/customCommands.js"

export async function handleCommand(term, cmd) {
    const args = cmd.trim().split(/\s+/)
    const commandPath = args[0]
    const restArgs = args.slice(1)

    if (commandPath === "clear") {
        clearCommand(term)
    } else if (commandPath === "help") {
        helpCommand(term)
    } else {
        await executeCustomCommand(term, cmd.trim(), [])
    }
    writeCommandLine(term)
}
