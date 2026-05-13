/**
 * @file Streaming deflate codec built on the Web `CompressionStream` /
 * `DecompressionStream` globals (`"deflate-raw"` format — no zlib wrapper,
 * smallest payload). Runs identically in Node 18+ and modern browsers so
 * the same bytes round-trip in either direction across the encode/decode
 * boundary.
 *
 * `decompressDeflateRaw` enforces a {@link MAX_DECOMPRESSED_BYTES} cap so
 * a tiny compressed payload can't expand into a decompression bomb on the
 * receiver. The check runs inline as bytes are emitted — pathological
 * inputs fail before the full payload is ever materialized in memory.
 */

/**
 * Maximum number of bytes the decoder will materialize from a single
 * decompressed payload, and the matching upper bound the encoder enforces
 * on raw JSON. 256 KiB sits ~30-50× above realistic prototype sizes
 * (current bundled demos are 4-7 KB compact JSON) while bounding worst-
 * case parse + AJV-validate workload to a few tens of milliseconds. A
 * single edit here moves both ends of the pipeline.
 */
export const MAX_DECOMPRESSED_BYTES = 262_144

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
 * Decompress a raw-deflate byte buffer to a UTF-8 string. A counting
 * `TransformStream` sits between the decompressor and the consumer; if
 * cumulative output would cross {@link MAX_DECOMPRESSED_BYTES}, the stream
 * is errored before the offending chunk is enqueued so the bomb never
 * lands in `Response`'s buffer.
 *
 * Errors (size cap or genuine corruption) propagate as rejected promises;
 * `decode` wraps them with the `decompress:` pipeline-stage prefix the
 * user sees.
 */
export async function decompressDeflateRaw(input: Uint8Array): Promise<string> {
    let total = 0
    const limiter = new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
            total += chunk.byteLength
            if (total > MAX_DECOMPRESSED_BYTES) {
                controller.error(
                    new Error(
                        `decompressed payload exceeds size limit of ${MAX_DECOMPRESSED_BYTES} bytes`
                    )
                )
                return
            }
            controller.enqueue(chunk)
        },
    })
    const stream = new Blob([input as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"))
        .pipeThrough(limiter)
    const buf = await new Response(stream).arrayBuffer()
    return new TextDecoder().decode(buf)
}
