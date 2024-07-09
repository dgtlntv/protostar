export const COMMAND_LINE_PREFIX = [
    { text: "user@ubuntu", color: "green" },
    { text: ":", color: "white" },
    { text: "~", color: "blue" },
    { text: "$ ", color: "white" },
]

export function getCommandLinePrefix() {
    return COMMAND_LINE_PREFIX
}

export function getCommandLinePrefixLength() {
    return COMMAND_LINE_PREFIX.reduce((acc, part) => acc + part.text.length, 0)
}
