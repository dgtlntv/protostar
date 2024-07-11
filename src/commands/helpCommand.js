import { customCommands } from "./customCommands.js"

export function helpCommand(term) {
    term.writeln("Available commands:")
    term.writeln("  help - Show available commands")
    listCommands(term, customCommands, "")
    term.writeln("\nType '<command> --help' for more information on a specific command.")
}

function listCommands(term, commands, prefix) {
    Object.entries(commands).forEach(([command, details]) => {
        const fullCommand = prefix ? `${prefix} ${command}` : command
        const aliases = details.aliases ? ` (${details.aliases.join(", ")})` : ""
        term.writeln(`  ${fullCommand}${aliases} - ${details.description}`)

        if (details.subcommands) {
            listCommands(term, details.subcommands, fullCommand)
        }
    })
}
