export function clearCommand(term) {
    term.clear()
    term.reset()
    term.write("\x1b[H")
}
