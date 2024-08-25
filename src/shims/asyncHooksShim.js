// node-async-hooks-shim.js

class AsyncLocalStorage {
    constructor() {
        this.store = new Map()
    }

    run(store, callback, ...args) {
        const id = Symbol()
        this.store.set(id, store)
        try {
            return callback(...args)
        } finally {
            this.store.delete(id)
        }
    }

    getStore() {
        return this.store.values().next().value
    }
}

class AsyncResource {
    static bind(fn) {
        return (...args) => {
            // This is a simplification. In a real implementation, you might
            // want to capture the execution context here.
            return fn(...args)
        }
    }
}

class HookError extends Error {
    constructor(message) {
        super(message)
        this.name = "HookError"
    }
}

class ValidationError extends Error {
    constructor(message) {
        super(message)
        this.name = "ValidationError"
    }
}

module.exports = {
    AsyncLocalStorage,
    AsyncResource,
    HookError,
    ValidationError,
}
