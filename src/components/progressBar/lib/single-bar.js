import _GenericBar from "./genericBar"
import _options from "./options"

// Progress-Bar constructor
export default class SingleBar extends _GenericBar {
    constructor(options, preset) {
        super(_options.parse(options, preset))

        // the update timer
        this.timer = null

        this.options.synchronousUpdate = false

        // update interval
        this.schedulingRate = this.options.notTTYSchedule
    }

    // internal render function
    render() {
        // stop timer
        if (this.timer) {
            clearTimeout(this.timer)
            this.timer = null
        }

        // run internal rendering
        super.render()

        // next update
        this.timer = setTimeout(this.render.bind(this), this.schedulingRate)
    }

    update(current, payload) {
        // timer inactive ?
        if (!this.timer) {
            return
        }

        super.update(current, payload)

        // trigger synchronous update ?
        // check for throttle time
        if (this.options.synchronousUpdate && this.lastRedraw + this.options.throttleTime * 2 < Date.now()) {
            // force update
            this.render()
        }
    }

    // start the progress bar
    start(total, startValue, payload) {
        // save current cursor settings
        this.terminal.cursorSave()

        // hide the cursor ?
        if (this.options.hideCursor === true) {
            this.terminal.cursor(false)
        }

        // disable line wrapping ?
        if (this.options.linewrap === false) {
            this.terminal.lineWrapping(false)
        }

        // initialize bar
        super.start(total, startValue, payload)

        // redraw on start!
        this.render()
    }

    // stop the bar
    stop() {
        // timer inactive ?
        if (!this.timer) {
            return
        }

        // trigger final rendering
        this.render()

        // restore state
        super.stop()

        // stop timer
        clearTimeout(this.timer)
        this.timer = null

        // cursor hidden ?
        if (this.options.hideCursor === true) {
            this.terminal.cursor(true)
        }

        // re-enable line wrapping ?
        if (this.options.linewrap === false) {
            this.terminal.lineWrapping(true)
        }

        // restore cursor on complete (position + settings)
        this.terminal.cursorRestore()

        // clear line on complete ?
        if (this.options.clearOnComplete) {
            this.terminal.cursorTo(0, null)
            this.terminal.clearLine()
        } else {
            // new line on complete
            this.terminal.newline()
        }
    }
}
