export type Duration = number | "random"

export interface TextComponent {
    component: "text"
    output: string
    duration?: Duration
}

export interface ProgressBarComponent {
    component: "progressBar"
    output: string
    duration: Duration
}

export interface SpinnerComponent {
    component: "spinner"
    output: string | string[]
    duration: Duration
    conclusion?: "stop" | "succeed" | "fail"
}

export interface TableComponent {
    component: "table"
    output: string[][]
    colWidths?: number[]
}

export interface ConditionalComponent {
    component: "conditional"
    output: {
        if: string
        then: Component | Component[]
        else?: Component | Component[]
    }
}

export interface VariableComponent {
    component: "variable"
    output: Record<string, string>
}

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

export interface BasicAuthComponent {
    component: "basicAuth"
    name: string
    message: string
    username: string
    password: string
    showPassword?: boolean
}

export interface ConfirmComponent {
    component: "confirm"
    name: string
    message: string
    initial?: boolean
}

export interface FormChoice {
    name: string
    message: string
    initial?: string
}

export interface FormComponent {
    component: "form"
    name: string
    message: string
    choices: FormChoice[]
}

export interface InputComponent {
    component: "input"
    name: string
    message: string
    initial?: string
}

export interface InvisibleComponent {
    component: "invisible"
    name: string
    message: string
}

export interface ListComponent {
    component: "list"
    name: string
    message: string
}

export interface MultiSelectChoice {
    name: string
    value: string
}

export interface MultiSelectComponent {
    component: "multiSelect"
    name: string
    message: string
    choices: MultiSelectChoice[]
    limit?: number
}

export interface NumberComponent {
    component: "number"
    name: string
    message: string
}

export interface PasswordComponent {
    component: "password"
    name: string
    message: string
}

export interface QuizComponent {
    component: "quiz"
    name: string
    message: string
    choices: string[]
    correctChoice: number
}

export interface SurveyScalePoint {
    name: string
    message: string
}

export interface SurveyChoice {
    name: string
    message: string
}

export interface SurveyComponent {
    component: "survey"
    name: string
    message: string
    scale: SurveyScalePoint[]
    choices: SurveyChoice[]
}

export interface ScaleChoice {
    name: string
    message: string
    initial?: number
}

export interface ScaleComponent {
    component: "scale"
    name: string
    message: string
    scale: SurveyScalePoint[]
    choices: ScaleChoice[]
}

export type SelectChoice =
    | { name: string; value: string; message?: string }

export interface SelectComponent {
    component: "select"
    name: string
    message: string
    choices: string[] | SelectChoice[]
}

export interface SortComponent {
    component: "sort"
    name: string
    message: string
    choices: string[]
}

export interface SnippetField {
    name: string
    message: string
}

export interface SnippetComponent {
    component: "snippet"
    name: string
    message: string
    fields: SnippetField[]
    template: string
}

export interface ToggleComponent {
    component: "toggle"
    name: string
    message: string
    enabled: string
    disabled: string
}

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
    | QuizComponent
    | SurveyComponent
    | ScaleComponent
    | SelectComponent
    | SortComponent
    | SnippetComponent
    | ToggleComponent

export type ArgType = "boolean" | "number" | "string"
export type OptionArgType = "array" | "count" | ArgType

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

export type CommandExample = [string, string] | [string, string][]

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

export interface Commands {
    $schema?: string
    welcome: string
    variables: Record<string, string>
    commands: Record<string, Command>
}
