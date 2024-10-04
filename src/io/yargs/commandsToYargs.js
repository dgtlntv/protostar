import componentsToYargsHandler from "./componentsToYargsHandler"

var globalVariables = {}

export default function commandsToYargs(yargs, config, localEcho) {
    globalVariables = config.variables

    function buildCommands(commands, yargs) {
        Object.entries(commands).forEach(([commandName, commandConfig]) => {
            yargs.command(
                /////////////////////////////////////////
                // Command name
                /////////////////////////////////////////
                commandName,

                /////////////////////////////////////////
                // Command description
                /////////////////////////////////////////
                commandConfig.description ||
                    commandConfig.desc ||
                    commandConfig.describe ||
                    "",
                (y) => {
                    /////////////////////////////////////////
                    // Aliases
                    /////////////////////////////////////////
                    if (commandConfig.alias) {
                        const aliases = Array.isArray(commandConfig.alias)
                            ? commandConfig.alias
                            : [commandConfig.alias]
                        aliases.forEach((alias) => {
                            y.alias(commandName, alias)
                        })
                    }

                    /////////////////////////////////////////
                    // Positional arguments
                    /////////////////////////////////////////
                    if (commandConfig.positional) {
                        Object.entries(commandConfig.positional).forEach(
                            ([argName, argConfig]) => {
                                y.positional(argName, argConfig)
                            }
                        )
                    }

                    /////////////////////////////////////////
                    // Options
                    /////////////////////////////////////////
                    if (commandConfig.options) {
                        Object.entries(commandConfig.options).forEach(
                            ([optionName, optionConfig]) => {
                                y.option(optionName, optionConfig)
                            }
                        )
                    }

                    /////////////////////////////////////////
                    // Examples
                    /////////////////////////////////////////
                    if (commandConfig.example) {
                        const examples = Array.isArray(commandConfig.example[0])
                            ? commandConfig.example
                            : [commandConfig.example]
                        examples.forEach(([cmd, desc]) => {
                            y.example(cmd, desc)
                        })
                    }

                    /////////////////////////////////////////
                    // Subcommands
                    /////////////////////////////////////////
                    if (commandConfig.commands) {
                        buildCommands(commandConfig.commands, y)
                    }

                    return y
                },

                /////////////////////////////////////////
                // Handler function
                /////////////////////////////////////////
                commandConfig.handler
                    ? async (argv) => {
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
                    : () => {
                          yargs.showHelp()
                      }
            )
        })
    }

    buildCommands(config.commands, yargs)

    // Add default commands
    yargs.command(
        "clear",
        "Clears the terminal",
        () => {},
        () => localEcho.clearTerminal()
    )
}
