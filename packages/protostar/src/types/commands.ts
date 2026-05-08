/**
 * @file TypeScript mirror of `src/commands-schema.json`. Authors of
 * `commands.json` files type their config against `Commands`; the shell,
 * runners, and component dispatcher consume the discriminated `Component`
 * union for exhaustive switches.
 */

/** Time in milliseconds, or the literal `"random"` for a 100–3000ms jitter. */
export type Duration = number | "random"

/** Plain text line. Optional `duration` introduces an artificial pause. */
export interface TextComponent {
    component: "text"
    output: string
    duration?: Duration
}

/** Animated progress bar that fills over `duration`. */
export interface ProgressBarComponent {
    component: "progressBar"
    output: string
    duration: Duration
}

/**
 * Animated spinner. `output` may be a single phrase or an array of phrases
 * the spinner cycles through. `conclusion` controls the final glyph.
 */
export interface SpinnerComponent {
    component: "spinner"
    output: string | string[]
    duration: Duration
    conclusion?: "stop" | "succeed" | "fail"
}

/** Bordered table. First row is the header. `colWidths` overrides auto-fit. */
export interface TableComponent {
    component: "table"
    output: string[][]
    colWidths?: number[]
}

/**
 * Branch on `if` (evaluated by `evalCondition`) and run `then` or `else`.
 * Either branch may be a single component or a list.
 */
export interface ConditionalComponent {
    component: "conditional"
    output: {
        if: string
        then: Component | Component[]
        else?: Component | Component[]
    }
}

/** Assigns each key of `output` to the matching `VariableStore` key. */
export interface VariableComponent {
    component: "variable"
    output: Record<string, string>
}

/** Type-to-filter selection that returns the chosen value. */
export interface AutoCompleteComponent {
    component: "autoComplete"
    name: string
    message: string
    choices: string[]
    limit?: number
    initial?: number
    multiple?: boolean
    footer?: string
}

/** Username/password challenge. Resolves to `true` only on a correct match. */
export interface BasicAuthComponent {
    component: "basicAuth"
    name: string
    message: string
    username: string
    password: string
    showPassword?: boolean
}

/** Yes/no question. Resolves to a boolean. */
export interface ConfirmComponent {
    component: "confirm"
    name: string
    message: string
    initial?: boolean
}

/** One field within a {@link FormComponent}. */
export interface FormChoice {
    name: string
    message: string
    initial?: string
}

/** Multi-field input form. Resolves to an object keyed by `choice.name`. */
export interface FormComponent {
    component: "form"
    name: string
    message: string
    choices: FormChoice[]
}

/** Single-line text input. */
export interface InputComponent {
    component: "input"
    name: string
    message: string
    initial?: string
}

/** Hidden text input — characters are not echoed. */
export interface InvisibleComponent {
    component: "invisible"
    name: string
    message: string
}

/** Comma-separated input split into a string array. */
export interface ListComponent {
    component: "list"
    name: string
    message: string
}

/** One choice within a {@link MultiSelectComponent}. */
export interface MultiSelectChoice {
    name: string
    value: string
}

/** Pick zero or more from a list. Resolves to an array of `value`s. */
export interface MultiSelectComponent {
    component: "multiSelect"
    name: string
    message: string
    choices: MultiSelectChoice[]
    limit?: number
}

/** Numeric input. */
export interface NumberComponent {
    component: "number"
    name: string
    message: string
}

/** Masked password input. */
export interface PasswordComponent {
    component: "password"
    name: string
    message: string
}

/**
 * Object form of a `select` choice. The bare `string[]` form is also
 * accepted; both produce the same UI.
 */
export type SelectChoice =
    | { name: string; value: string; message?: string }

/** Pick exactly one from a list. */
export interface SelectComponent {
    component: "select"
    name: string
    message: string
    choices: string[] | SelectChoice[]
}

/** Reorder a list. Resolves to the reordered string array. */
export interface SortComponent {
    component: "sort"
    name: string
    message: string
    choices: string[]
}

/** Two-state toggle with custom labels. Resolves to a boolean. */
export interface ToggleComponent {
    component: "toggle"
    name: string
    message: string
    enabled: string
    disabled: string
}

/**
 * Discriminated union over every component type. Exhaustive switches on
 * `component.component` get full coverage from this union.
 */
export type Component =
    | TextComponent
    | ProgressBarComponent
    | SpinnerComponent
    | TableComponent
    | ConditionalComponent
    | VariableComponent
    | AutoCompleteComponent
    | BasicAuthComponent
    | ConfirmComponent
    | FormComponent
    | InputComponent
    | InvisibleComponent
    | ListComponent
    | MultiSelectComponent
    | NumberComponent
    | PasswordComponent
    | SelectComponent
    | SortComponent
    | ToggleComponent

/** yargs primitive types valid on a positional argument. */
export type ArgType = "boolean" | "number" | "string"

/** yargs primitive types valid on an option (superset of {@link ArgType}). */
export type OptionArgType = "array" | "count" | ArgType

/** Configuration for a yargs positional argument. */
export interface PositionalOptions {
    alias?: string | string[]
    choices?: unknown[]
    default?: unknown
    demandOption?: boolean | string
    desc?: string
    describe?: string
    description?: string
    type?: ArgType
}

/** Configuration for a yargs option (flag). */
export interface CommandOptions {
    alias?: string | string[]
    choices?: unknown[]
    default?: unknown
    defaultDescription?: string
    demandOption?: boolean | string
    desc?: string
    describe?: string
    description?: string
    group?: string
    hidden?: boolean
    nargs?: number
    requiresArg?: boolean
    type?: OptionArgType
}

/** Single example or list of `[command, description]` pairs for `--help`. */
export type CommandExample = [string, string] | [string, string][]

/**
 * One entry in the command tree. May nest `commands` recursively for
 * subcommands. `handler` is the component (or component list) executed when
 * the command runs.
 */
export interface Command {
    description?: string
    desc?: string
    describe?: string
    alias?: string | string[]
    example?: CommandExample
    positional?: Record<string, PositionalOptions>
    options?: Record<string, CommandOptions>
    commands?: Record<string, Command>
    handler?: Component | Component[]
}

/**
 * Top-level shape of a `commands.json` file: welcome banner, declared
 * variables, and the root command tree.
 */
export interface Commands {
    $schema?: string
    welcome: string
    variables: Record<string, string>
    commands: Record<string, Command>
}
