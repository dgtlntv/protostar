class Interface {
    constructor() {}

    on(eventType, callback) {
        return globalThis.localEcho.on(eventType, callback)
    }

    close() {
        // Until there is a need we can keep these as noop
    }

    pause() {
        // Until there is a need we can keep these as noop
    }

    prompt(preserveCursor) {
        return globalThis.localEcho.printAndRestartPrompt(() => {})
    }

    resume() {
        // Until there is a need we can keep these as noop
    }

    setPrompt(prompt) {
        return globalThis.localEcho.setPrompt(prompt)
    }

    getPrompt() {
        return globalThis.localEcho.getPrompt().prompt
    }

    write(data, key) {
        return globalThis.localEcho.print(data)
    }

    /*
    We leave out a asyncIterator implementation until really needed
    [Symbol.asyncIterator]() {
    }
    */

    getCursorPos() {
        return globalThis.localEcho.cursorGetPosition()
    }

    question(query, ...args) {
        const [options = {}, callback] = args.length > 1 ? args : [{}, args[0]]

        globalThis.localEcho.print(query)

        const prompt = globalThis.localEcho.getPrompt().prompt
        globalThis.localEcho.read(prompt).then(() => {
            callback()
        })

        return
    }
}

function createInterface(options) {
    console.log("bruh")

    return new Interface(options)
}

function clearLine(stream, dir, callback) {
    globalThis.localEcho.clearLine(dir)
}

function clearScreenDown(stream, callback) {
    globalThis.localEcho.clearScreenDown()
}

function cursorTo(stream, x, y, callback) {
    globalThis.localEcho.cursorTo(x, y)
}

function moveCursor(stream, dx, dy, callback) {
    globalThis.localEcho.moveCursor(dx, dy)
}

function emitKeypressEvents(stream, rlinterface) {
    // empty function since the KeypressEvent is already enabled
}

export {
    Interface,
    createInterface,
    clearLine,
    clearScreenDown,
    cursorTo,
    moveCursor,
    emitKeypressEvents,
}
