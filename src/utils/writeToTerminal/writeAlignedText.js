export default function writeAlignedText(term, data, padding = 2) {
    if (data.length === 0) return

    // Calculate the maximum width of the first column
    const maxWidth = Math.max(...data.map((row) => row[0].length)) + padding

    // Write each row
    data.forEach((row) => {
        const [left, right] = row
        const paddedLeft = left.padEnd(maxWidth)
        term.writeln(`${paddedLeft}${right}`)
    })
}
