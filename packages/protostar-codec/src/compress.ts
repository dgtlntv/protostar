/**
 * @file Streaming deflate codec built on the Web `CompressionStream` /
 * `DecompressionStream` globals (`"deflate-raw"` format — no zlib wrapper,
 * smallest payload). Runs identically in Node 18+ and modern browsers so
 * the same bytes round-trip in either direction across the encode/decode
 * boundary.
 */

/**
 * Compress a UTF-8 string to a raw-deflate byte buffer. The output is
 * intentionally not gzip- or zlib-framed; a paired `decompressDeflateRaw`
 * call (or any `inflateRaw`-compatible decoder) reverses it.
 */
export async function compressDeflateRaw(input: string): Promise<Uint8Array> {
    const bytes = new TextEncoder().encode(input)
    const stream = new Blob([bytes as BlobPart])
        .stream()
        .pipeThrough(new CompressionStream("deflate-raw"))
    return new Uint8Array(await new Response(stream).arrayBuffer())
}

/**
 * Decompress a raw-deflate byte buffer to a UTF-8 string. Surfaces the
 * underlying stream error verbatim so callers can wrap it with the
 * pipeline-stage prefix the user sees ("decompress: ...").
 */
export async function decompressDeflateRaw(input: Uint8Array): Promise<string> {
    const stream = new Blob([input as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"))
    const buf = await new Response(stream).arrayBuffer()
    return new TextDecoder().decode(buf)
}
