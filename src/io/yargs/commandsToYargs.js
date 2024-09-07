import componentsToYargsHandler from "./componentsToYargsHandler"

var globalVariables = {}

export default function commandsToYargs(yargs, config, localEcho) {
    globalVariables = config.variables

    // Process custom commands
    Object.entries(config.commands).forEach(([commandName, commandConfig]) => {
        yargs.command(
            commandName,
            commandConfig.description ||
                commandConfig.desc ||
                commandConfig.describe,
            (yargs) => {
                // Process positional arguments
                if (commandConfig.positional) {
                    Object.entries(commandConfig.positional).forEach(
                        ([argName, argConfig]) => {
                            yargs.positional(argName, argConfig)
                        }
                    )
                }
                // Process options
                if (commandConfig.options) {
                    Object.entries(commandConfig.options).forEach(
                        ([optionName, optionConfig]) => {
                            yargs.option(optionName, optionConfig)
                        }
                    )
                }
                // Process subcommands recursively
                if (commandConfig.commands) {
                    Object.entries(commandConfig.commands).forEach(
                        ([subCommandName, subCommandConfig]) => {
                            yargs.command(
                                subCommandName,
                                subCommandConfig.description,
                                (subYargs) => {
                                    // Recursive call to handle nested commands
                                    commandsToYargs(
                                        subYargs,
                                        {
                                            commands: {
                                                [subCommandName]:
                                                    subCommandConfig,
                                            },
                                        },
                                        localEcho
                                    )
                                }
                            )
                        }
                    )
                }
            },
            // Add async handler function
            async (argv) => {
                try {
                    await componentsToYargsHandler(
                        commandConfig.handler,
                        argv,
                        localEcho,
                        globalVariables
                    )
                } catch (error) {
                    console.error("Error in command handler:", error)
                }
            }
        )

        // Handle command aliases
        if (commandConfig.alias) {
            const aliases = Array.isArray(commandConfig.alias)
                ? commandConfig.alias
                : [commandConfig.alias]
            aliases.forEach((alias) => {
                yargs.alias(commandName, alias)
            })
        }

        // Handle command examples
        if (commandConfig.example) {
            const examples = Array.isArray(commandConfig.example[0])
                ? commandConfig.example
                : [commandConfig.example]
            examples.forEach(([cmd, desc]) => {
                yargs.example(cmd, desc)
            })
        }
    })

    // Add default commands
    yargs.command(
        "clear",
        "Clears the terminal",
        () => {},
        () => localEcho.clearTerminal()
    )
}
