import writeHistoryCommand from "../writeToTerminal/writeHistoryCommand"

export default function handleArrowUp(term, historyIndex, commandHistory, prefixLength) {
    if (historyIndex < commandHistory.length - 1) {
        historyIndex++
        const command = commandHistory[historyIndex]
        writeHistoryCommand(term, command, prefixLength)
    }
    return historyIndex
}
