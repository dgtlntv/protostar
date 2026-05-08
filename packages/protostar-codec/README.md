# @dgtlntv/protostar-codec

URL-safe encoder/decoder for [Protostar](https://github.com/dgtlntv/protostar) CLI prototypes. Serializes a `Commands` config to a base64url, deflate-compressed payload suitable for sharing via the page hash, and decodes it back out with a clear per-stage error surface on failure.

The codec is what powers `https://dgtlntv.github.io/protostar/#p1=<payload>` — drop a config into a URL hash and the playground boots that prototype instead of the bundled demo.

## Install

```bash
pnpm add @dgtlntv/protostar-codec
```

## Library API

```ts
import { encode, decode, validateCommands } from "@dgtlntv/protostar-codec"
import type { Commands } from "@dgtlntv/protostar-codec"

// Encode: schema-validate → JSON.stringify → deflate-raw → base64url.
// Throws on schema-invalid input with the AJV path attached.
const payload: string = await encode(commandsData)
// → "p1=<base64url>"

// Decode: reverses the pipeline. Returns a discriminated result so
// every failure mode (malformed payload, decompression error, schema
// rejection, unsupported version) is handled without try/catch.
const result = await decode(payload)
if (result.ok) {
    runPrototype(result.commands)
} else {
    showErrorBanner(result.error) // e.g. "validate: /welcome: must be string"
}

// Stand-alone schema validation for callers that already have a
// parsed object and just want to check shape.
const validation = validateCommands(unknownInput)
```

The encoded format is **versioned** — every payload starts with `p1=`. A future format change (new compression, new alphabet) will swap to `p2=` rather than silently break links already in the wild.

## CLI

The package ships a `protostar-encode` binary. Reads a `commands.json` from stdin and writes a shareable URL (or just the fragment) to stdout.

```bash
cat commands.json | npx protostar-encode
# → https://dgtlntv.github.io/protostar/#p1=<base64url>

cat commands.json | npx protostar-encode --host https://my.site/path
# → https://my.site/path#p1=<base64url>

cat commands.json | npx protostar-encode --no-host
# → p1=<base64url>
```

Schema-invalid input exits non-zero with the AJV path on stderr.

## How it works

```
encode:  Commands → validate → JSON.stringify → deflate-raw → base64url → "p1=…"
decode:  "p1=…"   → base64url → deflate-raw   → JSON.parse  → validate  → Commands
```

The pipeline uses `CompressionStream` / `DecompressionStream` (the `"deflate-raw"` variant — no zlib framing, smallest payload) so the same code runs in Node 18+ and modern browsers without a polyfill.

## License

GPL-3.0
