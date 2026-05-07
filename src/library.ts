/**
 * @file Library entry point. Re-exports the public surface from
 * {@link ./index.ts} so consumers building against `dist/index.es.js` /
 * `dist/index.umd.js` get the same `Protostar` class and `Commands` types
 * as the dev application uses.
 */

// Side-effect import — installs a minimal `process` global before any
// pi-tui module body runs. See `./shims/processPolyfill.js` for why.
import "./shims/processPolyfill.js"

export { Protostar } from "./Protostar.js"
export type {
    Command,
    Commands,
    Component,
    Duration,
} from "./types/commands.js"
