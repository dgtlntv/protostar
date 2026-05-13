/**
 * @file Browser-side stand-in for `events`. pi-tui's `stdin-buffer.js`
 * does `class StdinBuffer extends EventEmitter`, so the `extends`
 * expression evaluates at module load — `EventEmitter` must resolve to
 * something extendable. `StdinBuffer` is only instantiated by pi-tui's
 * `ProcessTerminal`, which never runs in the browser, so the class
 * methods are never invoked. An empty constructable class suffices.
 */

/**
 * Empty stand-in matching the Node `EventEmitter` constructor signature
 * just enough to satisfy `extends`. No methods are wired because no
 * consumer of `StdinBuffer` runs in the browser.
 */
export class EventEmitter {}

export default { EventEmitter }
