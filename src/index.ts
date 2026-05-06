/**
 * @file Public entry point. Re-exports the `Protostar` class and the
 * `Commands` shape so consumers of the library build can `import { Protostar }
 * from "protostar"`.
 */

export { Protostar } from "./Protostar.js"
export type {
    Command,
    Commands,
    Component,
    Duration,
} from "./types/commands.js"
