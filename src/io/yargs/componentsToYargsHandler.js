import interpolateVariables from "../../components/text/interpolateVariables"
import sleep from "../../utils/sleep"
import ora from "ora"
import stopSpinner from "../../components/spinner/stopSpinner"
import { SingleBar } from "cli-progress"
import chalk from "chalk"
import Table from "cli-table3"
import stringWidth from "string-width"
import { prompt } from "enquirer"

export default async function componentsToYargsHandler(
    handlerComponents,
    argv,
    localEcho,
    globalVariables
) {
    const handler = Array.isArray(handlerComponents)
        ? handlerComponents
        : [handlerComponents]

    for (const component of handler) {
        switch (component.component) {
            case "text":
                const textOutput = interpolateVariables(
                    component.output,
                    argv,
                    globalVariables
                )

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
                                interpolateVariables(
                                    component.output,
                                    argv,
                                    globalVariables
                                ) +
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

                spinnerOutput.forEach((output, index) => {
                    spinnerOutput[index] = interpolateVariables(
                        output,
                        argv,
                        globalVariables
                    )
                })

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

                const interpolatedOutput = component.output.map((row) =>
                    row.map((cell) =>
                        interpolateVariables(cell, argv, globalVariables)
                    )
                )

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
                const columnCount = interpolatedOutput[0].length

                if (component.colWidths) {
                    // Scenario 1: User provided colWidths
                    colWidths = scaleColumnWidths(
                        [...component.colWidths],
                        maxWidth,
                        columnCount
                    )
                } else {
                    // Scenario 2: Calculate colWidths based on content
                    colWidths = interpolatedOutput[0].map(() => 0)

                    interpolatedOutput.forEach((row) => {
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
                    head: interpolatedOutput[0],
                    colWidths: colWidths,
                    wordWrap: true,
                    wrapOnWordBoundary: false,
                }

                const table = new Table(tableOptions)
                table.push(...interpolatedOutput.slice(1))

                localEcho.println(table.toString())
                break

            case "conditional":
                const condition = component.output.if
                const context = { ...argv, ...globalVariables }

                const evaluatedCondition = new Function(
                    ...Object.keys(context),
                    `return ${condition}`
                )(...Object.values(context))

                if (evaluatedCondition) {
                    await componentsToYargsHandler(
                        component.output.then,
                        argv,
                        localEcho,
                        globalVariables
                    )
                } else if (component.output.else) {
                    await componentsToYargsHandler(
                        component.output.else,
                        argv,
                        localEcho,
                        globalVariables
                    )
                }
                break

            case "variable":
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

            case "autoComplete":
                const autoComplete = await prompt({
                    type: "AutoComplete",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    limit: component.limit ? component.limit : 5,
                    initial: component.initial ? component.initial : 0,
                    choices: component.choices,
                    multiple: component.multiple ? component.multiple : false,
                    footer: component.footer
                        ? () => {
                              return chalk.dim(component.footer)
                          }
                        : () => {
                              return
                          },
                })

                globalVariables[component.name] = autoComplete[component.name]

                break

            case "basicAuth":
                const basicAuth = await prompt({
                    type: "BasicAuth",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    username: component.username,
                    password: component.password,
                    showPassword: component.showPassword
                        ? component.showPassword
                        : false,
                })

                globalVariables[component.name] = basicAuth[component.name]

                break

            case "confirm":
                const confirm = await prompt({
                    type: "confirm",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    initial: component.initial ? component.initial : false,
                })

                globalVariables[component.name] = confirm[component.name]

                break

            case "form":
                const form = await prompt({
                    type: "form",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    choices: component.choices,
                })

                globalVariables[component.name] = form[component.name]

                break

            case "input":
                const input = await prompt({
                    type: "input",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    initial: component.initial ? component.initial : "",
                })

                globalVariables[component.name] = input[component.name]

                break

            case "invisible":
                // TODO: Known bug. When typing certain characters like "ö" the cursor will move to the left
                // into the prompt where it shouldnt be "allowed" to be.
                const invisible = await prompt({
                    type: "invisible",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                })

                globalVariables[component.name] = invisible[component.name]

                break

            case "list":
                const list = await prompt({
                    type: "list",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                })

                globalVariables[component.name] = list[component.name]

                break

            case "multiSelect":
                const multiSelect = await prompt({
                    type: "MultiSelect",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    limit: component.limit ? component.limit : 5,
                    choices: component.choices,
                })

                globalVariables[component.name] = multiSelect[component.name]

                break

            case "number":
                const number = await prompt({
                    type: "number",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                })

                globalVariables[component.name] = number[component.name]

                break

            case "password":
                const password = await prompt({
                    type: "password",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                })

                globalVariables[component.name] = password[component.name]

                break

            case "quiz":
                const quiz = await prompt({
                    type: "quiz",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    choices: component.choices,
                    correctChoice: component.correctChoice,
                })

                globalVariables[component.name] = quiz[component.name]

                break

            case "survey":
                const survey = await prompt({
                    type: "survey",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    scale: component.scale,
                    margin: [0, 0, 2, 1],
                    choices: component.choices,
                })

                globalVariables[component.name] = survey[component.name]

                break

            case "scale":
                const scale = await prompt({
                    type: "scale",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    scale: component.scale,
                    margin: [0, 0, 2, 1],
                    choices: component.choices,
                })

                globalVariables[component.name] = scale[component.name]

                break

            case "select":
                const select = await prompt({
                    type: "select",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    choices: component.choices,
                })

                globalVariables[component.name] = select[component.name]

                break

            case "sort":
                const sort = await prompt({
                    type: "sort",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    choices: component.choices,
                })

                globalVariables[component.name] = sort[component.name]

                break

            case "snippet":
                const snippet = await prompt({
                    type: "snippet",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    required: true,
                    fields: component.fields,
                    template: JSON.stringify(
                        JSON.parse(component.template.replaceAll("\\n", "\n")),
                        null,
                        2
                    ),
                })

                globalVariables[component.name] = snippet[component.name]

                break

            case "toggle":
                const toggle = await prompt({
                    type: "toggle",
                    name: component.name,
                    message: interpolateVariables(
                        component.message,
                        argv,
                        globalVariables
                    ),
                    enabled: component.enabled,
                    disabled: component.disabled,
                })

                globalVariables[component.name] = toggle[component.name]

                break

            default:
                break
        }
    }
}
