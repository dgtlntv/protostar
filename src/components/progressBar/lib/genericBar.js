/*
The MIT License (X11 License)

Copyright (c) 2015-2022 Andi Dittrich

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
documentation files (the "Software"), to deal in the Software without restriction, including without limitation the 
rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the 
Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING 
BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND 
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY 
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, 
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

import _ETA from "./eta"
import _formatter from "./formatter"
import _options from "./options"
import _Terminal from "./terminal"

// Progress-Bar constructor
export default class GenericBar {
    constructor(options) {
        // store options and assign derived ones (instance specific)
        this.options = _options.assignDerivedOptions(options)

        // store terminal instance
        this.terminal = new _Terminal(this.options.localEchoController)

        // the current bar value
        this.value = 0

        // bar start value (used for progress calculation)
        this.startValue = 0

        // the end value of the bar
        this.total = 100

        // last drawn string - only render on change!
        this.lastDrawnString = null

        // start time (used for eta calculation)
        this.startTime = null

        // stop time (used for duration calculation)
        this.stopTime = null

        // last update time
        this.lastRedraw = Date.now()

        // default eta calculator (will be re-create on start)
        this.eta = new _ETA(this.options.etaBufferLength, 0, 0)

        // payload data
        this.payload = {}

        // progress bar active ?
        this.isActive = false

        // use default formatter or custom one ?
        this.formatter = typeof this.options.format === "function" ? this.options.format : _formatter
    }

    // internal render function
    render(forceRendering = false) {
        // formatter params
        const params = {
            progress: this.getProgress(),
            eta: this.eta.getTime(),
            startTime: this.startTime,
            stopTime: this.stopTime,
            total: this.total,
            value: this.value,
            maxWidth: this.terminal.getWidth(),
        }

        // automatic eta update ? (long running processes)
        if (this.options.etaAsynchronousUpdate) {
            this.updateETA()
        }

        // format string
        const s = this.formatter(this.options, params, this.payload)

        const forceRedraw = forceRendering || this.options.forceRedraw || true

        // string changed ? only trigger redraw on change!
        if (forceRedraw || this.lastDrawnString != s) {
            // set cursor to start of line
            this.terminal.cursorTo(0, null)

            // clear to the right from cursor
            this.terminal.clearRight()

            // write output
            this.terminal.write(s)

            // store string
            this.lastDrawnString = s

            // set last redraw time
            this.lastRedraw = Date.now()
        }
    }

    // start the progress bar
    start(total, startValue, payload) {
        // set initial values
        this.value = startValue || 0
        this.total = typeof total !== "undefined" && total >= 0 ? total : 100

        // set start value for progress calculation
        this.startValue = startValue || 0

        // store payload (optional)
        this.payload = payload || {}

        // store start time for duration+eta calculation
        this.startTime = Date.now()

        // reset stop time for 're-start' scenario (used for duration calculation)
        this.stopTime = null

        // reset string line buffer (redraw detection)
        this.lastDrawnString = ""

        // initialize eta buffer
        this.eta = new _ETA(this.options.etaBufferLength, this.startTime, this.value)

        // set flag
        this.isActive = true
    }

    // stop the bar
    stop() {
        // set flag
        this.isActive = false

        // store stop timestamp to get total duration
        this.stopTime = Date.now()
    }

    // update the bar value
    // update(value, payload)
    // update(payload)
    update(arg0, arg1 = {}) {
        // value set ?
        // update(value, [payload]);
        if (typeof arg0 === "number") {
            // update value
            this.value = arg0

            // add new value; recalculate eta
            this.eta.update(Date.now(), arg0, this.total)
        }

        // extract payload
        // update(value, payload)
        // update(payload)
        const payloadData = (typeof arg0 === "object" ? arg0 : arg1) || {}

        // merge payload
        for (const key in payloadData) {
            this.payload[key] = payloadData[key]
        }

        // limit reached ? autostop set ?
        if (this.value >= this.getTotal() && this.options.stopOnComplete) {
            this.stop()
        }
    }

    // calculate the actual progress value
    getProgress() {
        // calculate the normalized current progress
        let progress = this.value / this.total

        // use relative progress calculation ? range between startValue and total is then used as 100%
        // startValue (offset) is ignored for calculations
        if (this.options.progressCalculationRelative) {
            progress = (this.value - this.startValue) / (this.total - this.startValue)
        }

        // handle NaN Errors caused by total=0. Set to complete in this case
        if (isNaN(progress)) {
            progress = this.options && this.options.emptyOnZero ? 0.0 : 1.0
        }

        // limiter
        progress = Math.min(Math.max(progress, 0.0), 1.0)

        return progress
    }

    // update the bar value
    // increment(delta, payload)
    // increment(payload)
    increment(arg0 = 1, arg1 = {}) {
        // increment([payload]) => step=1
        // handle the use case when `step` is omitted but payload is passed
        if (typeof arg0 === "object") {
            this.update(this.value + 1, arg0)

            // increment([step=1], [payload={}])
        } else {
            this.update(this.value + arg0, arg1)
        }
    }

    // get the total (limit) value
    getTotal() {
        return this.total
    }

    // set the total (limit) value
    setTotal(total) {
        if (typeof total !== "undefined" && total >= 0) {
            this.total = total
        }
    }

    // force eta calculation update (long running processes)
    updateETA() {
        // add new value; recalculate eta
        this.eta.update(Date.now(), this.value, this.total)
    }
}
