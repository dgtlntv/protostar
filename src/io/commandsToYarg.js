export default function commandsToYarg(yargs, config) {
    // Process commands
    Object.entries(config.commands).forEach(([commandName, commandConfig]) => {
        yargs.command(
            commandName,
            commandConfig.description || commandConfig.desc || commandConfig.describe,
            (yargs) => {
                // Process positional arguments
                if (commandConfig.positional) {
                    Object.entries(commandConfig.positional).forEach(([argName, argConfig]) => {
                        yargs.positional(argName, argConfig)
                    })
                }

                // Process options
                if (commandConfig.options) {
                    Object.entries(commandConfig.options).forEach(([optionName, optionConfig]) => {
                        yargs.option(optionName, optionConfig)
                    })
                }

                // Process subcommands recursively
                if (commandConfig.commands) {
                    Object.entries(commandConfig.commands).forEach(([subCommandName, subCommandConfig]) => {
                        yargs.command(subCommandName, subCommandConfig.description, (subYargs) => {
                            // Recursive call to handle nested commands
                            createYargsParser(subYargs, { commands: { [subCommandName]: subCommandConfig } })
                        })
                    })
                }
            }
        )

        // Handle command aliases
        if (commandConfig.alias) {
            yargs.alias(commandName, commandConfig.alias)
        }

        // Handle command examples
        if (commandConfig.example) {
            const examples = Array.isArray(commandConfig.example[0]) ? commandConfig.example : [commandConfig.example]
            examples.forEach(([cmd, desc]) => {
                yargs.example(cmd, desc)
            })
        }
    })
}
