export default class CancellableOperation {
    constructor() {
        this.cancelled = false
    }

    cancel() {
        this.cancelled = true
    }

    isCancelled() {
        return this.cancelled
    }
}
