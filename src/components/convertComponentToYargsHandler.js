import interpolateVariables from "./text/interpolateVariables"
import sleep from "../utils/sleep"
import ora from "./spinner/ora"
import stopSpinner from "./spinner/stopSpinner"
import SingleBar from "./progressBar/lib/single-bar"
import chalk from "chalk"

export default async function convertComponentToYargsHandler(handlerComponents, argv, localEcho, globalVariables) {
    const handler = Array.isArray(handlerComponents) ? handlerComponents : [handlerComponents]

    //TODO: Every output needs to be interpolated so we can use args, flags and variables in text,
    //      progressbar text, spinner text, and settings variables.

    for (const component of handler) {
        switch (component.component) {
            case "text":
                const textOutput = interpolateVariables(component.output, argv)
                localEcho.print(textOutput + "\n")
                if (component.duration) {
                    component.duration === "random" ? await sleep() : await sleep(component.duration)
                }
                break

            case "progressBar":
                await new Promise((resolve) => {
                    const progressBar = new SingleBar(
                        { localEchoController: localEcho, notTTYSchedule: 20, hideCursor: true },
                        {
                            format: component.output + " | " + chalk.cyan("{bar}") + " | {percentage}% | ETA: {eta}s",
                            barCompleteChar: "\u2588",
                            barIncompleteChar: "\u2591",
                        }
                    )

                    const duration =
                        component.duration === "random" ? Math.floor(Math.random() * 2900) + 100 : component.duration
                    const totalSteps = 200

                    progressBar.start(totalSteps, 0)

                    let elapsedTime = 0

                    const updateBar = () => {
                        const variabilityFactor =
                            Math.random() < 0.6
                                ? Math.random() * 0.5 + 0.1 // 60% chance of "normal" progress
                                : Math.random() * 2 + 2 // 40% chance of "burst" progress

                        const avgStepDuration = duration / totalSteps
                        const stepDuration = Math.max(10, Math.floor(avgStepDuration * variabilityFactor))

                        elapsedTime += stepDuration
                        const progress = Math.min(totalSteps, Math.floor((elapsedTime / duration) * totalSteps))

                        progressBar.update(progress)

                        if (progress >= totalSteps || elapsedTime >= duration) {
                            progressBar.update(totalSteps)
                            progressBar.stop()
                            resolve()
                        } else {
                            // Add a small random delay between updates for more natural appearance
                            setTimeout(updateBar, Math.random() * 80)
                        }
                    }

                    updateBar()
                })
                break

            case "spinner":
                const spinnerStream = localEcho.startStream()
                var duration =
                    component.duration === "random" ? Math.floor(Math.random() * 2900) + 100 : component.duration
                const streamOutput = Array.isArray(component.output) ? component.output : [component.output]

                const spinner = await ora({
                    text: streamOutput[0],
                    stream: spinnerStream,
                    localEcho: localEcho,
                }).start()

                if (streamOutput.length > 1) {
                    for (const [index, streamOutputElement] of streamOutput.entries()) {
                        await sleep(duration / streamOutput.length, async () => {
                            if (index !== 0) spinner.text = streamOutputElement
                        })
                    }

                    await sleep(duration / streamOutput.length, async () => {
                        await stopSpinner(spinner, localEcho, component)
                    })
                } else {
                    await sleep(duration, async () => {
                        await stopSpinner(spinner, localEcho, component)
                    })
                }

                break

            case "table":
                // Implement table logic
                break

            case "conditional":
                // Implement conditional logic
                break

            case "variable":
                for (var variableName in component.output) {
                    if (variableName in globalVariables) {
                        globalVariables[variableName] = component.output[variableName]
                    } else {
                        console.error(`Error: Attempt to set undefined global variable '${variableName}'`)
                    }
                }

                break

            case "prompt":
                // Implement prompt logic
                break

            default:
                break
        }
    }
}
