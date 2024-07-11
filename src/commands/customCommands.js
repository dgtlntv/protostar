import { interpolate } from "../utils/interpolation.js"
import { writeColoredText } from "../utils/writeToTerminal/writeColoredText.js"
import writeTable from "../utils/writeToTerminal/writeTable.js"
import writeAlignedText from "../utils/writeToTerminal/writeAlignedText.js"
import { showProgressBar } from "../components/ProgressBar.js"
import { showSpinner } from "../components/Spinner.js"
import { handleUserPrompts } from "../components/Prompt.js"
import commandsData from "../commands.json"
import sleep from "../utils/sleep.js"
import CancellableOperation from "../utils/CancellableOperation.js"
import { setCurrentOperation } from "../components/KeyboardHandler.js"

export let customCommands = {}
export let globalVariables = {}

export function loadCommands() {
    try {
        let welcomeMessage = commandsData.welcome || false
        customCommands = commandsData.commands || {}
        globalVariables = commandsData.globalVariables || {}

        if (welcomeMessage) return welcomeMessage
    } catch (error) {
        console.error("Error loading commands and global variables:", error)
    }
}

export async function executeCustomCommand(term, commandPath, args) {
    const commandParts = commandPath.split(" ")
    const rootCommand = commandParts[0]
    let cmd = getCommand(rootCommand)

    if (!cmd) {
        term.writeln(`Unknown command: ${rootCommand}`)
        return
    }

    let currentPath = [rootCommand]

    // Traverse subcommands
    for (let i = 1; i < commandParts.length; i++) {
        const part = commandParts[i]
        if (cmd.subcommands && cmd.subcommands[part]) {
            cmd = cmd.subcommands[part]
            currentPath.push(part)
        } else {
            // We've reached the end of the valid command path
            break
        }
    }

    // Any remaining parts in commandParts are treated as arguments
    const remainingArgs = commandParts.slice(currentPath.length).concat(args)

    const { flags, positionalArgs, errors } = parseArgs(remainingArgs, cmd)

    if (flags["--help"] || flags["-h"]) {
        showCommandHelp(term, currentPath.join(" "))
        return
    }

    if (errors.length > 0) {
        errors.forEach((error) => term.writeln(`\x1b[31m${error}\x1b[0m`))
        term.writeln(`Type '${currentPath.join(" ")} --help' for usage information.`)
        return
    }

    const context = { flags, args: positionalArgs }

    if (cmd.prompts) {
        const promptResults = await handleUserPrompts(term, cmd.prompts)
        if (promptResults === null) {
            return
        }
        Object.assign(context, promptResults)
    }

    if (cmd.action) {
        await executeAction(term, cmd.action, context)
    } else if (cmd.subcommands && Object.keys(cmd.subcommands).length > 0) {
        showCommandHelp(term, currentPath.join(" "))
    } else {
        term.writeln(`Command '${currentPath.join(" ")}' is not properly configured.`)
    }
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
                        const value = parseQuotedString(args.slice(i + 1))
                        flags[flagName] = value.text
                        i += value.consumed
                    } else {
                        errors.push(`Error: Flag ${arg} expects a value but none was provided.`)
                    }
                }
            } else {
                errors.push(`Error: Unknown flag ${arg}`)
            }
        } else {
            const value = parseQuotedString(args.slice(i))
            positionalArgs.push(value.text)
            i += value.consumed - 1
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

function parseQuotedString(args) {
    let text = args[0]
    let consumed = 1

    if (text.startsWith('"') || text.startsWith("'")) {
        const quote = text[0]
        let endIndex = args.findIndex((arg, index) => index > 0 && arg.endsWith(quote) && !arg.endsWith("\\" + quote))

        if (endIndex === -1) {
            // If no closing quote is found, treat it as a single argument
            text = text.slice(1)
        } else {
            text = args.slice(0, endIndex + 1).join(" ")
            text = text.slice(1, -1) // Remove surrounding quotes
            consumed = endIndex + 1
        }
    }

    return { text, consumed }
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

function showCommandHelp(term, commandPath) {
    const commandParts = commandPath.split(" ")
    const rootCommand = commandParts[0]
    let cmd = getCommand(rootCommand)

    if (!cmd) {
        term.writeln(`Unknown command: ${rootCommand}`)
        return
    }

    // Traverse subcommands
    for (let i = 1; i < commandParts.length; i++) {
        const part = commandParts[i]
        if (cmd.subcommands && cmd.subcommands[part]) {
            cmd = cmd.subcommands[part]
        } else {
            term.writeln(`Unknown subcommand: ${commandPath}`)
            return
        }
    }

    term.writeln(
        `Usage: ${commandPath} ${cmd.subcommands ? "SUBCOMMAND" : ""} ${cmd.flags ? "[OPTIONS]" : ""} ${
            cmd.args ? "[ARGS]..." : ""
        }\n`
    )
    term.writeln(`${cmd.description}\n`)

    if (cmd.args) {
        term.writeln("Arguments:")
        const argData = cmd.args.map((arg) => [`  ${arg.name}`, arg.description])
        writeAlignedText(term, argData)
        term.writeln("")
    }

    if (cmd.flags) {
        term.writeln("Options:")
        const flagData = [
            ["  -h, --help", "Show this message and exit."],
            ...Object.entries(cmd.flags || {}).map(([flag, details]) => {
                const aliases = details.aliases ? details.aliases.map((a) => `${a}`).join(", ") : ""
                const flagStr = aliases ? `${aliases}, ${flag}` : `${flag}`
                return [`  ${flagStr}`, details.description || ""]
            }),
        ]
        writeAlignedText(term, flagData)
        term.writeln("")
    }

    if (cmd.subcommands) {
        term.writeln("Commands:")
        const subcommandData = Object.entries(cmd.subcommands).map(([subcommand, details]) => [
            `  ${subcommand}`,
            details.description,
        ])
        writeAlignedText(term, subcommandData)
    }
}

async function executeAction(term, action, context) {
    const operation = new CancellableOperation()
    setCurrentOperation(operation)
    try {
        if (Array.isArray(action)) {
            for (const item of action) {
                if (operation.isCancelled()) {
                    return
                }
                await processActionItem(term, item, context, operation)
                term.write("\r\n")
            }
        } else {
            await processActionItem(term, action, context, operation)
        }
    } finally {
        setCurrentOperation(null)
    }
}

async function processActionItem(term, item, context, operation) {
    if (typeof item === "string") {
        writeColoredText(term, interpolate(item, { ...context, globalVariables }), "white")
        term.write("\r\n")
    } else if (typeof item === "object") {
        if (item.setVariable) {
            const variableName = item.setVariable
            if (variableName in globalVariables) {
                const value = interpolate(item.value, { ...context, globalVariables })
                globalVariables[variableName] = value
            } else {
                console.error(`Error: Attempt to set undefined global variable '${variableName}'`)
            }
        } else if (item.if) {
            const condition = interpolate(item.if, { ...context, globalVariables })
            let result
            try {
                result = new Function("context", `with(context) { return ${condition}; }`)({
                    ...context,
                    globalVariables,
                })
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
            const data = interpolate(JSON.stringify(item.data), { ...context, globalVariables })
            const parsedData = JSON.parse(data)
            writeTable(term, parsedData)
        } else if (item.type === "progressBar") {
            await showProgressBar(
                term,
                interpolate(item.text, { ...context, globalVariables }),
                item.duration,
                operation
            )
        } else if (item.type === "spinner") {
            await showSpinner(
                term,
                item.texts.map((text) => interpolate(text, { ...context, globalVariables })),
                item.duration,
                operation
            )
        } else if (item.command) {
            await executeCustomCommand(term, item.command, [])
        } else if (item.text) {
            writeColoredText(term, interpolate(item.text, { ...context, globalVariables }), item.color || "white")
            if (item.delay) {
                await sleep(item.delay, operation)
            }
        }
    }
}
