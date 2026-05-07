import type { Terminal as XTerminal } from "@xterm/xterm"

/**
 * Minimal subset of the live `PromptLine` exposed for e2e assertions. Only
 * the fields the helper module reads from the browser context are listed
 * here; the real class is much richer.
 */
export interface PromptLineHandle {
    getValue(): string
    getCursor(): number
}

/**
 * Minimal subset of the live `ShellLoop`. `currentPrompt` is `null` while a
 * command is running and a `PromptLineHandle` while the shell is idle.
 */
export interface ShellHandle {
    readonly currentPrompt: PromptLineHandle | null
}

/**
 * Subset of the `HistoryStore` surface the helpers may inspect. Kept open
 * so the dev handle can grow without churning every spec — only the
 * methods used by helpers need to be declared.
 */
export interface HistoryHandle {
    push(entry: string): void
}

/** Subset of `VariableStore` exposed for assertions. */
export interface VariablesHandle {
    get(key: string): unknown
}

/**
 * Dev-only browser handle the e2e specs talk to. Helpers read editing
 * state via queries against `shell.currentPrompt`.
 */
export interface ProtostarHandle {
    term: XTerminal
    tui: unknown
    shell: ShellHandle
    history: HistoryHandle
    variables: VariablesHandle
}

declare global {
    interface Window {
        __protostar: ProtostarHandle
    }
}

export {}
