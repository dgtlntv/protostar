/**
 * @file Library entry point. Re-exports the public surface from
 * {@link ./index.ts} so consumers building against `dist/index.es.js` /
 * `dist/index.umd.js` get the same `Protostar` class and `Commands` types
 * as the dev application uses.
 */

export { Protostar } from "./Protostar.js"
export type {
    Command,
    Commands,
    Component,
    Duration,
} from "./types/commands.js"
