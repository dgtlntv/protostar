export default function writeTable(term, data) {
    if (!Array.isArray(data) || data.length === 0) {
        term.writeln("No data to display")
        return
    }

    const headers = data[0]
    const rows = data.slice(1)

    // Calculate column widths
    const columnWidths = headers.map((header, index) => {
        const maxWidth = Math.max(header.length, ...rows.map((row) => String(row[index]).length))
        return maxWidth + 2 // Add padding
    })

    // Print headers
    let headerRow = "│"
    headers.forEach((header, index) => {
        headerRow += ` ${header.padEnd(columnWidths[index])}│`
    })
    const separator = "─".repeat(headerRow.length)

    term.writeln(separator)
    term.writeln(headerRow)
    term.writeln(separator)

    // Print rows
    rows.forEach((row) => {
        let rowString = "│"
        row.forEach((cell, index) => {
            rowString += ` ${String(cell).padEnd(columnWidths[index])}│`
        })
        term.writeln(rowString)
    })

    term.writeln(separator)
    term.write("\r\n")
}
