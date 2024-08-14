import ora from "../components/ora"

function interpolateVariables(text, argv) {
    return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return argv[variable] || match
    })
}

async function convertComponentToHandler(handlerComponents, argv, localEcho) {
    const handler = Array.isArray(handlerComponents) ? handlerComponents : [handlerComponents]

    for (const component of handler) {
        switch (component.component) {
            case "text":
                const output = interpolateVariables(component.output, argv)
                localEcho.print(output + "\n")
                if (component.duration) {
                    if (component.duration === "random") {
                        // Simulate random duration between 100ms and 1000ms
                        const randomDuration = Math.floor(Math.random() * 900) + 100
                        await new Promise((resolve) => setTimeout(resolve, randomDuration))
                    } else {
                        await new Promise((resolve) => setTimeout(resolve, component.duration))
                    }
                }
                break
            case "progressBar":
                // Implement progress bar logic
                break
            case "spinner":
                const stream = localEcho.startStream()
                var duration = 0

                if (component.duration === "random") {
                    // Simulate random duration between 100ms and 1000ms
                    duration = Math.floor(Math.random() * 900) + 100
                } else {
                    duration = component.duration
                }

                const spinner = await ora({
                    text: "Loading...",
                    stream: stream,
                }).start()

                await new Promise((resolve) =>
                    setTimeout(async () => {
                        await spinner.succeed("Operation complete!")
                        await localEcho.endStream()
                        resolve()
                    }, component.duration)
                )

                break
            case "table":
                // Implement table logic
                break
            case "conditional":
                // Implement conditional logic
                break
            case "variable":
                // Implement variable logic
                break
            case "prompt":
                // Implement prompt logic
                break
            default:
                break
        }
    }
}

export default function commandsToYarg(yargs, config, localEcho) {
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
                            commandsToYarg(subYargs, { commands: { [subCommandName]: subCommandConfig } }, localEcho)
                        })
                    })
                }
            },
            // Add async handler function
            async (argv) => {
                try {
                    await convertComponentToHandler(commandConfig.handler, argv, localEcho)
                } catch (error) {
                    console.error("Error in command handler:", error)
                }
            }
        )

        // Handle command aliases
        if (commandConfig.alias) {
            const aliases = Array.isArray(commandConfig.alias) ? commandConfig.alias : [commandConfig.alias]
            aliases.forEach((alias) => {
                yargs.alias(commandName, alias)
            })
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
