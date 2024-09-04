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

            case "autoComplete":
                const autoComplete = await prompt({
                    type: "AutoComplete",
                    name: "flavor",
                    message: "Pick your favorite flavor",
                    limit: 10,
                    initial: 2,
                    choices: [
                        "Almond",
                        "Apple",
                        "Banana",
                        "Blackberry",
                        "Blueberry",
                        "Cherry",
                        "Chocolate",
                        "Cinnamon",
                        "Coconut",
                        "Cranberry",
                        "Grape",
                        "Nougat",
                        "Orange",
                        "Pear",
                        "Pineapple",
                        "Raspberry",
                        "Strawberry",
                        "Vanilla",
                        "Watermelon",
                        "Wintergreen",
                    ],
                })

                localEcho.println(
                    "your response was " + JSON.stringify(autoComplete)
                )

                break

            case "basicAuth":
                const basicAuth = await prompt({
                    type: "BasicAuth",
                    name: "password",
                    message: "Please enter your password",
                    username: "rajat-sr",
                    password: "123",
                    showPassword: true,
                })

                localEcho.println(
                    "your response was " + JSON.stringify(basicAuth)
                )

                break

            case "confirm":
                const confirm = await prompt({
                    type: "confirm",
                    name: "question",
                    message: "Want to answer?",
                })

                localEcho.println(
                    "your response was " + JSON.stringify(confirm)
                )

                break

            case "form":
                const form = await prompt({
                    type: "form",
                    name: "user",
                    message: "Please provide the following information:",
                    choices: [
                        {
                            name: "firstname",
                            message: "First Name",
                            initial: "Jon",
                        },
                        {
                            name: "lastname",
                            message: "Last Name",
                            initial: "Schlinkert",
                        },
                        {
                            name: "username",
                            message: "GitHub username",
                            initial: "jonschlinkert",
                        },
                    ],
                })

                localEcho.println("your response was " + JSON.stringify(form))

                break

            case "input":
                const input = await prompt({
                    type: "input",
                    name: "username",
                    message: "What is your username?",
                })

                localEcho.println("your response was " + JSON.stringify(input))

                break

            case "invisible":
                const invisible = await prompt({
                    type: "invisible",
                    name: "secret",
                    message: "What is your secret?",
                })

                localEcho.println(
                    "your response was " + JSON.stringify(invisible)
                )

                break

            case "list":
                const list = await prompt({
                    type: "list",
                    name: "keywords",
                    message: "Type comma-separated keywords",
                })

                localEcho.println("your response was " + JSON.stringify(list))

                break

            case "multiSelect":
                const multiSelect = await prompt({
                    type: "MultiSelect",
                    name: "value",
                    message: "Pick your favorite colors",
                    limit: 7,
                    choices: [
                        { name: "aqua", value: "#00ffff" },
                        { name: "black", value: "#000000" },
                        { name: "blue", value: "#0000ff" },
                        { name: "fuchsia", value: "#ff00ff" },
                        { name: "gray", value: "#808080" },
                        { name: "green", value: "#008000" },
                        { name: "lime", value: "#00ff00" },
                        { name: "maroon", value: "#800000" },
                        { name: "navy", value: "#000080" },
                        { name: "olive", value: "#808000" },
                        { name: "purple", value: "#800080" },
                        { name: "red", value: "#ff0000" },
                        { name: "silver", value: "#c0c0c0" },
                        { name: "teal", value: "#008080" },
                        { name: "white", value: "#ffffff" },
                        { name: "yellow", value: "#ffff00" },
                    ],
                })

                localEcho.println(
                    "your response was " + JSON.stringify(multiSelect)
                )

                break

            case "number":
                const number = await prompt({
                    type: "number",
                    name: "number",
                    message: "Please enter a number",
                })

                localEcho.println("your response was " + JSON.stringify(number))

                break

            case "password":
                const password = await prompt({
                    type: "password",
                    name: "password",
                    message: "What is your password?",
                })

                localEcho.println(
                    "your response was " + JSON.stringify(password)
                )

                break

            case "quiz":
                const quiz = await prompt({
                    type: "quiz",
                    name: "countries",
                    message: "How many countries are there in the world?",
                    choices: ["165", "175", "185", "195", "205"],
                    correctChoice: 3,
                })

                localEcho.println("your response was " + JSON.stringify(quiz))

                break

            case "survey":
                const survey = await prompt({
                    type: "survey",
                    name: "experience",
                    message: "Please rate your experience",
                    scale: [
                        { name: "1", message: "Strongly Disagree" },
                        { name: "2", message: "Disagree" },
                        { name: "3", message: "Neutral" },
                        { name: "4", message: "Agree" },
                        { name: "5", message: "Strongly Agree" },
                    ],
                    margin: [0, 0, 2, 1],
                    choices: [
                        {
                            name: "interface",
                            message: "The website has a friendly interface.",
                        },
                        {
                            name: "navigation",
                            message: "The website is easy to navigate.",
                        },
                        {
                            name: "images",
                            message: "The website usually has good images.",
                        },
                        {
                            name: "upload",
                            message:
                                "The website makes it easy to upload images.",
                        },
                        {
                            name: "colors",
                            message:
                                "The website has a pleasing color palette.",
                        },
                    ],
                })

                localEcho.println("your response was " + JSON.stringify(survey))

                break

            case "scale":
                const scale = await prompt({
                    type: "scale",
                    name: "experience",
                    message: "Please rate your experience",
                    scale: [
                        { name: "1", message: "Strongly Disagree" },
                        { name: "2", message: "Disagree" },
                        { name: "3", message: "Neutral" },
                        { name: "4", message: "Agree" },
                        { name: "5", message: "Strongly Agree" },
                    ],
                    margin: [0, 0, 2, 1],
                    choices: [
                        {
                            name: "interface",
                            message: "The website has a friendly interface.",
                            initial: 2,
                        },
                        {
                            name: "navigation",
                            message: "The website is easy to navigate.",
                            initial: 2,
                        },
                        {
                            name: "images",
                            message: "The website usually has good images.",
                            initial: 2,
                        },
                        {
                            name: "upload",
                            message:
                                "The website makes it easy to upload images.",
                            initial: 2,
                        },
                        {
                            name: "colors",
                            message:
                                "The website has a pleasing color palette.",
                            initial: 2,
                        },
                    ],
                })

                localEcho.println("your response was " + JSON.stringify(scale))

                break

            case "select":
                const select = await prompt({
                    type: "select",
                    name: "color",
                    message: "Pick a flavor",
                    choices: [
                        "apple",
                        "grape",
                        "watermelon",
                        "cherry",
                        "orange",
                    ],
                })

                localEcho.println("your response was " + JSON.stringify(select))

                break

            case "snippet":
                const snippet = await prompt({
                    type: "snippet",
                    name: "username",
                    message: "Fill out the fields in package.json",
                    required: true,
                    fields: [
                        {
                            name: "author_name",
                            message: "Author Name",
                        },
                        {
                            name: "version",
                        },
                    ],
                    template: `{
                        "name": "\${name}",
                        "description": "\${description}",
                        "version": "\${version}",
                        "homepage": "https://github.com/\${username}/\${name}",
                        "author": "\${author_name} (https://github.com/\${username})",
                        "repository": "\${username}/\${name}",
                        "license": "\${license:ISC}"
                    }
                    `,
                })

                localEcho.println(
                    "your response was " + JSON.stringify(snippet)
                )

                break

            case "toggle":
                const toggle = await prompt({
                    type: "toggle",
                    message: "Want to answer?",
                    enabled: "Yep",
                    disabled: "Nope",
                })

                localEcho.println("your response was " + JSON.stringify(toggle))

                break

            default:
                break
        }
    }
}
