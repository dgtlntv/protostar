export default function handleArrowLeft(term, cursorX, prefixLength) {
    if (cursorX > prefixLength) {
        term.write("\x1b[D")
        return true
    }
    return false
}
