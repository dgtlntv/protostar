import { interpolate } from "../utils/interpolation.js"
import { writeColoredText } from "../utils/writeToTerminal/writeColoredText.js"
import writeTable from "../utils/writeToTerminal/writeTable.js"
import { showProgressBar } from "../components/ProgressBar.js"
import { showSpinner } from "../components/Spinner.js"
import { handleUserPrompts } from "../components/Prompt.js"
import commandsData from "../commands.json"

export let customCommands = {}

export function loadCommands() {
    try {
        customCommands = commandsData.commands || {}
    } catch (error) {
        console.error("Error loading commands:", error)
    }
}

export async function executeCustomCommand(term, command, args) {
    const cmd = getCommand(command)
    if (!cmd) {
        term.writeln(`Unknown command: ${command}`)
        return
    }

    const { flags, positionalArgs, errors } = parseArgs(args, cmd)

    if (flags["--help"] || flags["-h"]) {
        showCommandHelp(term, command)
        return
    }

    if (errors.length > 0) {
        errors.forEach((error) => term.writeln(`\x1b[31m${error}\x1b[0m`))
        term.writeln(`Type '${command} --help' for usage information.`)
        return
    }

    const context = { flags, args: positionalArgs }

    if (cmd.subcommands && positionalArgs.length > 0) {
        const subcommand = cmd.subcommands[positionalArgs[0]]
        if (subcommand) {
            await executeAction(term, subcommand.action, context)
            return
        }
    }

    if (cmd.prompts) {
        const promptResults = await handleUserPrompts(term, cmd.prompts)
        Object.assign(context.flags, promptResults)
    }

    if (cmd.action === undefined) {
        showCommandHelp(term, command)
        return
    }

    await executeAction(term, cmd.action, context)
}

function getCommand(command) {
    return (
        customCommands[command] ||
        Object.values(customCommands).find((cmd) => cmd.aliases && cmd.aliases.includes(command))
    )
}

function parseArgs(args, cmd) {
    const flags = {}
    const positionalArgs = []
    const flagDefs = {
        "--help": { type: "boolean", description: "Show help for this command", aliases: ["-h"] },
        ...(cmd.flags || {}),
    }
    const aliasMap = createFlagAliasMap(flagDefs)
    const errors = []

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg.startsWith("-")) {
            const flagName = aliasMap[arg]
            if (flagName) {
                const flagDef = flagDefs[flagName]
                if (flagDef.type === "boolean") {
                    flags[flagName] = true
                } else if (flagDef.type === "string") {
                    if (i + 1 < args.length) {
                        flags[flagName] = args[++i]
                    } else {
                        errors.push(`Error: Flag ${arg} expects a value but none was provided.`)
                    }
                }
            } else {
                errors.push(`Error: Unknown flag ${arg}`)
            }
        } else {
            positionalArgs.push(arg)
        }
    }

    // Check for required flags
    Object.entries(flagDefs).forEach(([flagName, flagDef]) => {
        if (flagDef.required && !(flagName in flags)) {
            errors.push(`Error: Required flag ${flagName} was not provided.`)
        }
    })

    return { flags, positionalArgs, errors }
}

function createFlagAliasMap(flags) {
    const aliasMap = {}
    Object.entries(flags).forEach(([flag, details]) => {
        aliasMap[flag] = flag
        if (details.aliases) {
            details.aliases.forEach((alias) => {
                aliasMap[alias] = flag
            })
        }
    })
    return aliasMap
}

function showCommandHelp(term, command) {
    const cmd = getCommand(command)
    if (cmd) {
        term.writeln(`${command} - ${cmd.description}`)
        if (cmd.args) {
            term.writeln("\nArguments:")
            cmd.args.forEach((arg) => {
                term.writeln(`  ${arg.name}: ${arg.description}`)
            })
        }
        if (cmd.flags) {
            term.writeln("\nFlags:")
            Object.entries(cmd.flags).forEach(([flag, details]) => {
                const aliases = details.aliases ? ` (${details.aliases.join(", ")})` : ""
                term.writeln(`  ${flag}${aliases}: ${details.description}`)
            })
        }
        if (cmd.subcommands) {
            term.writeln("\nSubcommands:")
            Object.entries(cmd.subcommands).forEach(([subcommand, details]) => {
                term.writeln(`  ${subcommand} - ${details.description}`)
            })
        }
    } else {
        term.writeln(`No help available for '${command}'.`)
    }
}

async function executeAction(term, action, context) {
    if (Array.isArray(action)) {
        for (const item of action) {
            await processActionItem(term, item, context)
        }
    } else if (typeof action === "object") {
        await processActionItem(term, action, context)
    } else if (typeof action === "string") {
        writeColoredText(term, interpolate(action, context), "white")
        term.write("\r\n")
    }
}

async function processActionItem(term, item, context) {
    if (typeof item === "string") {
        writeColoredText(term, interpolate(item, context), "white")
        term.write("\r\n")
    } else if (typeof item === "object") {
        if (item.if) {
            const condition = interpolate(item.if, context)
            let result
            try {
                result = new Function("context", `with(context) { return ${condition}; }`)(context)
            } catch (error) {
                console.error("Error evaluating condition:", error)
                result = false
            }
            if (result) {
                await executeAction(term, item.then, context)
            } else if (item.else) {
                await executeAction(term, item.else, context)
            }
        } else if (item.format === "table") {
            const data = interpolate(JSON.stringify(item.data), context)
            const parsedData = JSON.parse(data)
            writeTable(term, parsedData)
        } else if (item.type === "progressBar") {
            await showProgressBar(term, interpolate(item.text, context), item.duration)
        } else if (item.type === "spinner") {
            await showSpinner(term, interpolate(item.text, context), item.duration)
        } else if (item.command) {
            await executeCustomCommand(term, item.command, [])
        } else if (item.text) {
            writeColoredText(term, interpolate(item.text, context), item.color || "white")
            term.write("\r\n")
            if (item.delay) {
                await new Promise((resolve) => setTimeout(resolve, item.delay))
            }
        }
    }
}
