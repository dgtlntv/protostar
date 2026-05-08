/**
 * @file Minimal `process` polyfill installed before pi-tui's module
 * bodies execute.
 *
 * pi-tui reads `process.env.PI_*` at class-field-initializer time
 * (e.g. `tui.js` `showHardwareCursor = process.env.PI_HARDWARE_CURSOR === "1"`)
 * and calls `process.nextTick(...)` from its render scheduler. Without a
 * `process` global the very first `new TUI(...)` call throws a
 * `ReferenceError`. We previously pulled in `vite-plugin-node-polyfills`
 * for this; a few-line shim covers the actual runtime needs without the
 * extra dependency, and it also ships with the library build so consumers
 * don't have to provide their own polyfill.
 *
 * Side-effect-imported as the very first import of every entry point so
 * it runs ahead of any pi-tui module body. Gated on `globalThis.process`
 * being absent so it's a no-op in Node-host environments (e.g. SSR).
 */

if (typeof globalThis.process === "undefined") {
    globalThis.process = {
        // pi-tui reads `process.env.PI_HARDWARE_CURSOR`,
        // `process.env.PI_CLEAR_ON_SHRINK`, `process.env.PI_DEBUG_REDRAW`,
        // `process.env.PI_TUI_DEBUG`, and `process.env.TERMUX_VERSION`.
        // All are opt-in flags that compare against `"1"`; defaulting to
        // an empty object means every comparison evaluates to `false`.
        env: {},
        // pi-tui's render scheduler dispatches via `process.nextTick`;
        // the closest browser equivalent is a microtask.
        nextTick: (cb, ...args) => queueMicrotask(() => cb(...args)),
    }
}
