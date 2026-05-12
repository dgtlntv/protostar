# @dgtlntv/protostar

A browser-based CLI prototyping library. Renders an xterm.js terminal and lets authors declaratively define commands via a JSON configuration. Commands run a sequence of components — text, spinner, progress bar, table, interactive prompts — all client-side, no server required.

## Install

```bash
npm install @dgtlntv/protostar
```

## Usage

The published bundle is self-contained — no shim aliases or polyfills required.

```javascript
import "@xterm/xterm/css/xterm.css"
import "@dgtlntv/protostar/styles.css"
import { Protostar } from "@dgtlntv/protostar"
import commandsData from "./commands.json"

document.addEventListener("DOMContentLoaded", () => {
    const protostar = new Protostar(
        document.getElementById("terminal"),
        commandsData
    )
    protostar.start()
})
```

## Configuration

Define your CLI prototype in a `commands.json`:

```json
{
    "welcome": "Welcome to My CLI! Type 'help' for available commands.",
    "variables": {
        "username": "dgtlntv",
        "isLoggedIn": "false"
    },
    "commands": {
        "hello": {
            "description": "Say hello",
            "handler": [
                { "component": "text", "lines": ["Hello, world!"] }
            ]
        }
    }
}
```

- **`welcome`** — optional banner shown when the CLI loads.
- **`variables`** — optional key/value pairs readable and writable across commands.
- **`commands`** — the available CLI commands, each with a handler containing a list of components.

### Components

`text`, `spinner`, `progressBar`, `table`, `duration`, `variable`, `conditional`, and interactive prompts (`input`, `number`, `password`, `invisible`, `list`, `select`, `autoComplete`, `multiSelect`, `confirm`, `form`, `basicAuth`, `toggle`, `sort`).

See the [main repository README](https://github.com/dgtlntv/protostar#components) for full component documentation.

## URL Sharing

Pair with [`@dgtlntv/protostar-codec`](https://www.npmjs.com/package/@dgtlntv/protostar-codec) to encode a `commands.json` into a shareable URL that boots the prototype in the hosted playground — no fork or deploy needed.

## License

GPL-3.0
