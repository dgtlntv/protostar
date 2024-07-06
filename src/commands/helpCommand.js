import { customCommands } from "./customCommands.js"

export function helpCommand(term) {
    term.writeln("Available commands:")
    term.writeln("  help - Show available commands")
    Object.entries(customCommands).forEach(([command, details]) => {
        const aliases = details.aliases ? ` (${details.aliases.join(", ")})` : ""
        term.writeln(`  ${command}${aliases} - ${details.description}`)
    })
    term.writeln("\nType '<command> --help' for more information on a specific command.")
}
