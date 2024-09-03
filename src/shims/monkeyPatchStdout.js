// This function monkey patches everything that is available in the LocalEchoController
// and some stdout specific functions onto the global process object
// so that libraries made for node can write to the terminal simulator
// The monkey patch is called in the root javascript file

export default function monkeyPatchStdout() {
    if (typeof process !== "undefined" && !process.stdout) {
        const self = globalThis.localEcho

        if (typeof self !== "undefined") {
            // Create a proxy object that forwards method calls to the LocalEchoController
            const controllerProxy = new Proxy(
                {},
                {
                    get(target, prop) {
                        if (typeof self[prop] === "function") {
                            return function (...args) {
                                return self[prop].apply(self, args)
                            }
                        }
                        return self[prop]
                    },
                }
            )

            // Create mockStdout with the proxy as its prototype
            const mockStdout = Object.create(controllerProxy, {
                write: {
                    value: function (data) {
                        self.print(data)
                    },
                    writable: true,
                    configurable: true,
                },
                isTTY: {
                    value: true,
                    writable: true,
                    configurable: true,
                },
                setRawMode: {
                    value: function () {},
                    writable: true,
                    configurable: true,
                },
                columns: {
                    get: function () {
                        return self._termSize.cols || 80
                    },
                    configurable: true,
                },
                rows: {
                    get: function () {
                        return self._termSize.rows || 24
                    },
                    configurable: true,
                },
            })

            // Ensure process.stdout and process.stderr both point to our mock
            process.stdout = process.stdin = process.stderr = mockStdout

            // Update columns and rows when terminal is resized
            globalThis.localEcho.term.onResize(({ cols, rows }) => {
                self._termSize.cols = cols
                self._termSize.rows = rows
            })
        }
    }
}
