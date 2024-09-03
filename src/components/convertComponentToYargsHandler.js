import interpolateVariables from "./text/interpolateVariables"
import sleep from "../utils/sleep"
import ora from "ora"
import stopSpinner from "./spinner/stopSpinner"
import { SingleBar } from "cli-progress"
import chalk from "chalk"
import Table from "cli-table3"
import stringWidth from "string-width"
import { prompt } from "enquirer"

export default async function convertComponentToYargsHandler(
    handlerComponents,
    argv,
    localEcho,
    globalVariables
) {
    const handler = Array.isArray(handlerComponents)
        ? handlerComponents
        : [handlerComponents]

    //TODO: Every output needs to be interpolated so we can use args, flags and variables in text,
    //      progressbar text, spinner text, and settings variables.

    for (const component of handler) {
        switch (component.component) {
            case "text":
                const textOutput = interpolateVariables(component.output, argv)
                localEcho.print(textOutput + "\n")
                if (component.duration) {
                    component.duration === "random"
                        ? await sleep()
                        : await sleep(component.duration)
                }
                break

            case "progressBar":
                await new Promise((resolve) => {
                    const progressBar = new SingleBar(
                        { hideCursor: true },
                        {
                            format:
                                component.output +
                                " | " +
                                chalk.cyan("{bar}") +
                                " | {percentage}% | ETA: {eta}s",
                            barCompleteChar: "\u2588",
                            barIncompleteChar: "\u2591",
                        }
                    )

                    const duration =
                        component.duration === "random"
                            ? Math.floor(Math.random() * 2900) + 100
                            : component.duration
                    const totalSteps = 200

                    progressBar.start(totalSteps, 0)

                    let elapsedTime = 0

                    const updateBar = () => {
                        const variabilityFactor =
                            Math.random() < 0.6
                                ? Math.random() * 0.5 + 0.1 // 60% chance of "normal" progress
                                : Math.random() * 2 + 2 // 40% chance of "burst" progress

                        const avgStepDuration = duration / totalSteps
                        const stepDuration = Math.max(
                            10,
                            Math.floor(avgStepDuration * variabilityFactor)
                        )

                        elapsedTime += stepDuration
                        const progress = Math.min(
                            totalSteps,
                            Math.floor((elapsedTime / duration) * totalSteps)
                        )

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
                var duration =
                    component.duration === "random"
                        ? Math.floor(Math.random() * 2900) + 100
                        : component.duration
                const spinnerOutput = Array.isArray(component.output)
                    ? component.output
                    : [component.output]

                const spinner = ora({
                    text: spinnerOutput[0],
                    stream: process.stdout,
                    discardStdin: false,
                }).start()

                if (spinnerOutput.length > 1) {
                    for (const [
                        index,
                        spinnerOutputElement,
                    ] of spinnerOutput.entries()) {
                        await sleep(
                            duration / spinnerOutput.length,
                            async () => {
                                if (index !== 0)
                                    spinner.text = spinnerOutputElement
                            }
                        )
                    }

                    await sleep(duration / spinnerOutput.length, async () => {
                        await stopSpinner(spinner, component)
                    })
                } else {
                    await sleep(duration, async () => {
                        await stopSpinner(spinner, component)
                    })
                }

                break

            case "table":
                const maxWidth = process.stdout.columns || 80
                const cellPadding = 2 // Assuming 1 space padding on each side of the cell content
                const borderWidth = 1 // Width of vertical border character
                const cornerWidth = 1 // Width of corner characters
                const minColumnWidth = 3 // Minimum width for each column

                function scaleColumnWidths(colWidths, maxWidth, columnCount) {
                    const totalPadding = cellPadding * columnCount
                    const totalBorderWidth = borderWidth * (columnCount + 1)
                    const availableWidth =
                        maxWidth -
                        totalPadding -
                        totalBorderWidth -
                        2 * cornerWidth
                    const totalContentWidth = colWidths.reduce(
                        (sum, width) => sum + width,
                        0
                    )

                    if (totalContentWidth > availableWidth) {
                        const scaleFactor = availableWidth / totalContentWidth
                        return colWidths.map((width) =>
                            Math.max(
                                minColumnWidth,
                                Math.floor(width * scaleFactor)
                            )
                        )
                    }

                    // Ensure minimum width even when not scaling down
                    return colWidths.map((width) =>
                        Math.max(minColumnWidth, width)
                    )
                }

                let colWidths
                const columnCount = component.output[0].length

                if (component.colWidths) {
                    // Scenario 1: User provided colWidths
                    colWidths = scaleColumnWidths(
                        [...component.colWidths],
                        maxWidth,
                        columnCount
                    )
                } else {
                    // Scenario 2: Calculate colWidths based on content
                    colWidths = component.output[0].map(() => 0)

                    component.output.forEach((row) => {
                        row.forEach((cell, index) => {
                            const cellWidth = stringWidth(cell.toString())
                            if (cellWidth > colWidths[index]) {
                                colWidths[index] = cellWidth
                            }
                        })
                    })

                    colWidths = scaleColumnWidths(
                        colWidths,
                        maxWidth,
                        columnCount
                    )
                }

                const tableOptions = {
                    head: component.output[0],
                    colWidths: colWidths,
                    wordWrap: true,
                    wrapOnWordBoundary: false,
                }

                const table = new Table(tableOptions)
                table.push(...component.output.slice(1))

                localEcho.println(table.toString())
                break

            case "conditional":
                // TODO: We need to check this actually works
                const condition = component.output.if
                const context = { ...argv, ...globalVariables }

                const evaluatedCondition = new Function(
                    ...Object.keys(context),
                    `return ${condition}`
                )(...Object.values(context))

                if (evaluatedCondition) {
                    await convertComponentToYargsHandler(
                        [component.output.then],
                        argv,
                        localEcho,
                        globalVariables
                    )
                } else if (component.output.else) {
                    await convertComponentToYargsHandler(
                        [component.output.else],
                        argv,
                        localEcho,
                        globalVariables
                    )
                }
                break

            case "variable":
                // TODO: We need to check this actually works
                for (var variableName in component.output) {
                    if (variableName in globalVariables) {
                        globalVariables[variableName] =
                            component.output[variableName]
                    } else {
                        console.error(
                            `Error: Attempt to set undefined global variable '${variableName}'`
                        )
                    }
                }

                break

            case "prompt":
                const response = await prompt({
                    type: "input",
                    name: "username",
                    message: "What is your username?",
                })

                console.log(response)
                break

            default:
                break
        }
    }
}
