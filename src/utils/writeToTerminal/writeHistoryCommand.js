export default function writeHistoryCommand(term, command, prefixLength) {
    term.write("\x1b[2K\r")
    term.write(" ".repeat(prefixLength))
    term.write("\r")
    term.write(" ".repeat(prefixLength) + command)
}
