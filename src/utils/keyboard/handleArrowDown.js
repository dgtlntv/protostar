import writeHistoryCommand from "../writeToTerminal/writeHistoryCommand"

export default function handleArrowDown(term, historyIndex, commandHistory, prefixLength) {
    if (historyIndex > -1) {
        historyIndex--
        const command = historyIndex >= 0 ? commandHistory[historyIndex] : ""
        writeHistoryCommand(term, command, prefixLength)
    }
    return historyIndex
}
