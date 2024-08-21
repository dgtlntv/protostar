const readline = {
    cursorTo: (stream, x, y) => {
        process.stdout.cursorTo(x, y)
    },

    moveCursor: (stream, dx, dy) => {
        process.stdout.moveCursor(dx, dy)
    },

    clearLine: (stream, dir) => {
        process.stdout.clearLine(dir)
    },

    clearScreenDown: (stream) => {
        process.stdout.clearScreenDown()
    },
}

module.exports = readline
