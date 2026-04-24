import type { Terminal as XTerminal } from "@xterm/xterm"

export interface LocalEchoHandle {
    _input: string
    _cursor: number
    _active: boolean
    _activePrompt: {
        prompt: string
        continuationPrompt: string
        resolve: ((value: string) => void) | null
        reject: ((reason?: unknown) => void) | null
    } | null
}

export interface ProtostarHandle {
    term: XTerminal
    localEcho: LocalEchoHandle
}

declare global {
    interface Window {
        __protostar: ProtostarHandle
    }
}

export {}
