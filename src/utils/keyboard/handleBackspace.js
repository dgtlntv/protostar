export default function handleBackspace(term, cursorX, prefixLength) {
    if (cursorX > prefixLength) {
        term.write("\b \b")
        return true
    }
    return false
}
