import writeHistoryCommand from "../writeToTerminal/writeHistoryCommand.js"

export default function handleArrowDown(term, historyIndex, commandHistory) {
    if (historyIndex > -1) {
        historyIndex--
        const command = historyIndex >= 0 ? commandHistory[historyIndex] : ""
        writeHistoryCommand(term, command)
    }
    return historyIndex
}
