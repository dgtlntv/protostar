/**
 * Structural type for the subset of the yargs API that Protostar uses.
 *
 * `yargs/browser` ships a `.d.ts` that references a missing
 * `yargs-factory.d.ts`, so `ReturnType<typeof Yargs>` resolves to `{}`
 * under strict tsconfigs — every chained call triggers typescript-eslint's
 * `no-unsafe-*` family. This interface captures exactly the methods we call
 * so the rest of the codebase stays fully typed.
 *
 * If a new yargs method is needed, add its signature here rather than
 * downgrading lint rules.
 */
export interface YargsInstance {
    command(
        name: string,
        description: string,
        builder: (y: YargsInstance) => YargsInstance | void,
        handler?: (argv: Record<string, unknown>) => void | Promise<void>,
    ): YargsInstance

    option(key: string, opts: object): YargsInstance
    positional(key: string, opts: object): YargsInstance
    alias(name: string, alias: string): YargsInstance
    example(cmd: string, desc: string): YargsInstance

    demandCommand(min: number, msg?: string): YargsInstance
    strict(): YargsInstance
    usageConfiguration(config: Record<string, unknown>): YargsInstance

    fail(
        fn: (
            msg: string,
            err: Error,
            yargs: YargsInstance,
        ) => void,
    ): YargsInstance

    showHelp(fn?: (help: string) => void): void

    parse(
        args: string | string[],
        cb: (
            err: Error | undefined,
            argv: unknown,
            output: string,
        ) => void,
    ): Promise<unknown>
}
