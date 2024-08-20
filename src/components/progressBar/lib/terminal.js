// low-level terminal interactions
export default class Terminal {
    constructor(localEchoController) {
        this.localEchoController = localEchoController

        // default: line wrapping enabled
        this.linewrap = true

        // current, relative y position
        this.dy = 0
    }

    // save cursor position + settings
    cursorSave() {
        this.localEchoController.cursorSavePosition()
    }

    // restore last cursor position + settings
    cursorRestore() {
        this.localEchoController.cursorRestorePosition()
    }

    // show/hide cursor
    cursor(enabled) {
        if (enabled) {
            this.localEchoController.cursorShow()
        } else {
            this.localEchoController.cursorHide()
        }
    }

    // change cursor positionn
    cursorTo(x = null, y = null) {
        this.localEchoController.cursorTo(x, y)
    }

    // change relative cursor position
    cursorRelative(dx = null, dy = null) {
        // store current position
        this.dy = this.dy + dy

        this.localEchoController.moveCursor(dx, dy)
    }

    // relative reset
    cursorRelativeReset() {
        // move cursor to initial line
        if (this.dy > 0) {
            this.localEchoController.cursorUp(this.dy)
        }

        // first char
        this.localEchoController.cursorLeft()

        // reset counter
        this.dy = 0
    }

    // clear to the right from cursor
    clearRight() {
        this.localEchoController.eraseEndLine()
    }

    // clear the full line
    clearLine() {
        this.localEchoController.eraseLine()
    }

    // clear everyting beyond the current line
    clearBottom() {
        this.localEchoController.eraseDown()
    }

    // add new line; increment counter
    newline() {
        this.localEchoController.print("\n")
        this.dy++
    }

    // write content to output stream
    // @TODO use string-width to strip length
    write(s, rawWrite = false) {
        // line wrapping enabled ? trim output
        // this is just a fallback mechanism in case user enabled line-wrapping via options or set it to auto
        if (this.linewrap === true && rawWrite === false) {
            this.localEchoController.print(s.substr(0, this.getWidth()))

            // standard behaviour with disabled linewrapping
        } else {
            this.localEchoController.print(s)
        }
    }

    // control line wrapping
    lineWrapping(enabled) {
        // store state
        this.linewrap = enabled
        if (enabled) {
            this.localEchoController.print("\x1B[?7h")
        } else {
            this.localEchoController.print("\x1B[?7l")
        }
    }

    // tty environment ?
    isTTY() {
        return false
    }

    // get terminal width
    getWidth() {
        // set max width to 80 in tty-mode and 200 in notty-mode
        return 200
    }
}
