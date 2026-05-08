/**
 * @file Public entry point for `@dgtlntv/protostar-codec`. Re-exports the
 * encode/decode pipeline plus the schema validator. Consumers (the
 * playground, the agent skill that mints share links, downstream tooling)
 * import from here and never reach into the per-stage modules.
 */

export { encode, ENCODING_VERSION } from "./encode.js"
export { decode } from "./decode.js"
export type { DecodeOk, DecodeErr, DecodeResult } from "./decode.js"
export { validateCommands } from "./validate.js"
export type {
    ValidateOk,
    ValidateErr,
    ValidateResult,
} from "./validate.js"
export {
    compressDeflateRaw,
    decompressDeflateRaw,
    MAX_DECOMPRESSED_BYTES,
} from "./compress.js"
export { bytesToBase64url, base64urlToBytes } from "./base64url.js"
export type { Commands } from "@dgtlntv/protostar"
