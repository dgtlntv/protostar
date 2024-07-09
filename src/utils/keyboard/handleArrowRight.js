export default function handleArrowRight(term, cursorX, lineLength) {
    if (cursorX < lineLength) {
        term.write("\x1b[C")
        return true
    }
    return false
}
