import writeHistoryCommand from "../writeToTerminal/writeHistoryCommand.js"

export default function handleArrowUp(term, historyIndex, commandHistory) {
    if (historyIndex < commandHistory.length - 1) {
        historyIndex++
        const command = commandHistory[historyIndex]
        writeHistoryCommand(term, command)
    }
    return historyIndex
}
