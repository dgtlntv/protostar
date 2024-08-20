/*
MIT License

Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated 
documentation files (the "Software"), to deal in the Software without restriction, including without limitation 
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and 
to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of 
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO 
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS 
IN THE SOFTWARE.
*/

// Import only the necessary dependencies
import chalk from "chalk"
import cliSpinners from "cli-spinners"
import logSymbols from "log-symbols"
import stripAnsi from "strip-ansi"
import stringWidth from "string-width"

class Ora {
    _linesToClear = 0
    _lineCount = 0
    _frameIndex = 0
    _options
    _spinner
    _stream
    _id
    _initialInterval
    _isEnabled
    _isSilent
    _indent
    _text
    _prefixText
    _suffixText

    color

    constructor(options) {
        if (typeof options === "string") {
            options = {
                text: options,
            }
        }

        this._options = {
            color: "cyan",
            discardStdin: true,
            hideCursor: true,
            ...options,
        }

        // Public
        this.color = this._options.color

        // It's important that these use the public setters.
        this.spinner = this._options.spinner

        this._initialInterval = this._options.interval
        this._stream = this._options.stream
        this._localEcho = this._options.localEcho
        this._isEnabled = typeof this._options.isEnabled === "boolean" ? this._options.isEnabled : true
        this._isSilent = typeof this._options.isSilent === "boolean" ? this._options.isSilent : false

        // Set *after* `this._stream`.
        // It's important that these use the public setters.
        this.text = this._options.text
        this.prefixText = this._options.prefixText
        this.suffixText = this._options.suffixText
        this.indent = this._options.indent
    }

    get indent() {
        return this._indent
    }

    set indent(indent = 0) {
        if (!(indent >= 0 && Number.isInteger(indent))) {
            throw new Error("The `indent` option must be an integer from 0 and up")
        }

        this._indent = indent
        this._updateLineCount()
    }

    get interval() {
        return this._initialInterval ?? this._spinner.interval ?? 100
    }

    get spinner() {
        return this._spinner
    }

    set spinner(spinner) {
        this._frameIndex = 0
        this._initialInterval = undefined

        if (typeof spinner === "object") {
            if (spinner.frames === undefined) {
                throw new Error("The given spinner must have a `frames` property")
            }

            this._spinner = spinner
        } else if (spinner === undefined) {
            // Set default spinner
            this._spinner = cliSpinners.dots
        } else if (spinner !== "default" && cliSpinners[spinner]) {
            this._spinner = cliSpinners[spinner]
        } else {
            throw new Error(
                `There is no built-in spinner named '${spinner}'. See https://github.com/sindresorhus/cli-spinners/blob/main/spinners.json for a full list.`
            )
        }
    }

    get text() {
        return this._text
    }

    set text(value = "") {
        this._text = value
        this._updateLineCount()
    }

    get prefixText() {
        return this._prefixText
    }

    set prefixText(value = "") {
        this._prefixText = value
        this._updateLineCount()
    }

    get suffixText() {
        return this._suffixText
    }

    set suffixText(value = "") {
        this._suffixText = value
        this._updateLineCount()
    }

    get isSpinning() {
        return this._id !== undefined
    }

    _getFullPrefixText(prefixText = this._prefixText, postfix = " ") {
        if (typeof prefixText === "string" && prefixText !== "") {
            return prefixText + postfix
        }

        if (typeof prefixText === "function") {
            return prefixText() + postfix
        }

        return ""
    }

    _getFullSuffixText(suffixText = this._suffixText, prefix = " ") {
        if (typeof suffixText === "string" && suffixText !== "") {
            return prefix + suffixText
        }

        if (typeof suffixText === "function") {
            return prefix + suffixText()
        }

        return ""
    }

    _updateLineCount() {
        const columns = this._stream.columns ?? 80
        const fullPrefixText = this._getFullPrefixText(this._prefixText, "-")
        const fullSuffixText = this._getFullSuffixText(this._suffixText, "-")
        const fullText = " ".repeat(this._indent) + fullPrefixText + "--" + this._text + "--" + fullSuffixText

        this._lineCount = 0
        for (const line of stripAnsi(fullText).split("\n")) {
            this._lineCount += Math.max(1, Math.ceil(stringWidth(line, { countAnsiEscapeCodes: true }) / columns))
        }
    }

    get isEnabled() {
        return this._isEnabled && !this._isSilent
    }

    set isEnabled(value) {
        if (typeof value !== "boolean") {
            throw new TypeError("The `isEnabled` option must be a boolean")
        }

        this._isEnabled = value
    }

    get isSilent() {
        return this._isSilent
    }

    set isSilent(value) {
        if (typeof value !== "boolean") {
            throw new TypeError("The `isSilent` option must be a boolean")
        }

        this._isSilent = value
    }

    frame() {
        const { frames } = this._spinner
        let frame = frames[this._frameIndex]

        if (this.color) {
            frame = chalk[this.color](frame)
        }

        this._frameIndex = ++this._frameIndex % frames.length
        const fullPrefixText =
            typeof this._prefixText === "string" && this._prefixText !== "" ? this._prefixText + " " : ""
        const fullText = typeof this.text === "string" ? " " + this.text : ""
        const fullSuffixText =
            typeof this._suffixText === "string" && this._suffixText !== "" ? " " + this._suffixText : ""

        return fullPrefixText + frame + fullText + fullSuffixText
    }

    async clear() {
        if (!this._isEnabled) {
            return this
        }

        for (let i = 0; i < this._linesToClear; i++) {
            await this._stream.write("\r\x1b[K\x1b[A")
        }
        await this._stream.write("\r\x1b[K")

        if (this._indent) {
            await this._stream.write(" ".repeat(this._indent))
        }

        this._linesToClear = 0

        return this
    }

    async render() {
        if (this._isSilent) {
            return this
        }

        await this.clear()
        await this._stream.write(this.frame() + "\n")
        this._linesToClear = this._lineCount

        return this
    }

    async start(text) {
        if (text) {
            this.text = text
        }

        if (this._isSilent) {
            return this
        }

        if (!this._isEnabled) {
            if (this.text) {
                await this._stream.write(`- ${this.text}\n`)
            }

            return this
        }

        if (this.isSpinning) {
            return this
        }

        if (this._options.hideCursor) {
            this._localEcho.cursorHide()
        }

        await this.render()
        this._id = setInterval(this.render.bind(this), this.interval)

        return this
    }

    async stop() {
        if (!this._isEnabled) {
            return this
        }

        clearInterval(this._id)
        this._id = undefined
        this._frameIndex = 0
        await this.clear()
        if (this._options.hideCursor) {
            this._localEcho.cursorShow()
        }

        return this
    }

    async succeed(text) {
        return this.stopAndPersist({ symbol: logSymbols.success, text })
    }

    async fail(text) {
        return this.stopAndPersist({ symbol: logSymbols.error, text })
    }

    async warn(text) {
        return this.stopAndPersist({ symbol: logSymbols.warning, text })
    }

    async info(text) {
        return this.stopAndPersist({ symbol: logSymbols.info, text })
    }

    async stopAndPersist(options = {}) {
        if (this._isSilent) {
            return this
        }

        const prefixText = options.prefixText ?? this._prefixText
        const fullPrefixText = this._getFullPrefixText(prefixText, " ")

        const symbolText = options.symbol ?? " "

        const text = options.text ?? this.text
        const fullText = typeof text === "string" ? " " + text : ""

        const suffixText = options.suffixText ?? this._suffixText
        const fullSuffixText = this._getFullSuffixText(suffixText, " ")

        const textToWrite = fullPrefixText + symbolText + " " + fullText + fullSuffixText + "\n"

        await this.stop()
        await this._stream.write(textToWrite)

        return this
    }
}

export default function ora(options) {
    return new Ora(options)
}

export { default as spinners } from "cli-spinners"
