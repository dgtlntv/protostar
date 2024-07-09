import { interpolate } from "../utils/interpolation.js"
import { writeColoredText } from "../utils/writeToTerminal/writeColoredText.js"
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

    const { flags, positionalArgs } = parseArgs(args, cmd)

    if (flags["--help"] || flags["-h"]) {
        showCommandHelp(term, command)
        return
    }

    if (cmd.subcommands && positionalArgs.length > 0) {
        const subcommand = cmd.subcommands[positionalArgs[0]]
        if (subcommand) {
            await executeAction(term, subcommand.action, flags, positionalArgs.slice(1))
            return
        }
    }

    if (cmd.prompts) {
        const promptResults = await handleUserPrompts(term, cmd.prompts)
        Object.assign(flags, promptResults)
        await executeAction(term, cmd.action, flags, positionalArgs)
        return
    }

    await executeAction(term, cmd.action, flags, positionalArgs)
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
    const flagAliases = createFlagAliasMap(cmd.flags)

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]
        if (arg.startsWith("-")) {
            const flagName = flagAliases[arg]
            if (flagName) {
                const flagDetails = cmd.flags[flagName]
                if (flagDetails.requiresValue && i + 1 < args.length) {
                    flags[flagName] = args[++i]
                } else {
                    flags[flagName] = true
                }
            }
        } else {
            positionalArgs.push(arg)
        }
    }

    return { flags, positionalArgs }
}

function createFlagAliasMap(flags) {
    const aliasMap = {}
    if (!flags) return aliasMap

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

async function executeAction(term, action, flags, args) {
    const context = { flags, args }

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
            if (eval(condition)) {
                await executeAction(term, item.then, context.flags, context.args)
            } else if (item.else) {
                await executeAction(term, item.else, context.flags, context.args)
            }
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
