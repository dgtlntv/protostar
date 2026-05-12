/**
 * @file Safelisted expression evaluator for `conditional` components.
 *
 * Replaces the legacy `new Function("with(ctx) return " + expr)` evaluator,
 * which executed arbitrary JavaScript supplied via JSON. This implementation
 * accepts only a fixed grammar — equality (`===`/`!==`/`==`/`!=`), boolean
 * (`&&`/`||`/`!`), parens, identifier lookup against the merged context,
 * and string/number/boolean/null literals — and rejects anything else
 * (function calls, property access, assignment, `new`, ternary, regex,
 * comma, etc.) at parse time.
 */

type TokenKind =
    | "ident"
    | "string"
    | "number"
    | "op"
    | "lparen"
    | "rparen"

interface Token {
    kind: TokenKind
    value: string
}

const OPERATORS = ["===", "!==", "==", "!=", "&&", "||", "!"] as const
type Operator = (typeof OPERATORS)[number]

/** Thrown by {@link evalCondition} when the expression is outside the safelist. */
export class ConditionSyntaxError extends Error {
    /** @param message Human-readable description of the rejection. */
    constructor(message: string) {
        super(message)
        this.name = "ConditionSyntaxError"
    }
}

/**
 * Lex `input` into a flat token list. Accepts whitespace, parens, single- or
 * double-quoted strings (with `\`-escapes), decimal numbers, identifiers, and
 * the operators in {@link OPERATORS}. Anything else throws
 * {@link ConditionSyntaxError}.
 *
 * @param input Source expression.
 * @returns The full token list, ready for parsing.
 * @throws {ConditionSyntaxError} On an unexpected character or unterminated
 *   string literal.
 */
function tokenize(input: string): Token[] {
    const tokens: Token[] = []
    let i = 0
    while (i < input.length) {
        const ch = input[i]
        if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
            i++
            continue
        }
        if (ch === "(") {
            tokens.push({ kind: "lparen", value: "(" })
            i++
            continue
        }
        if (ch === ")") {
            tokens.push({ kind: "rparen", value: ")" })
            i++
            continue
        }
        if (ch === '"' || ch === "'") {
            const quote = ch
            let j = i + 1
            let str = ""
            while (j < input.length && input[j] !== quote) {
                if (input[j] === "\\" && j + 1 < input.length) {
                    str += input[j + 1]
                    j += 2
                } else {
                    str += input[j]
                    j++
                }
            }
            if (j >= input.length) {
                throw new ConditionSyntaxError("Unterminated string literal")
            }
            tokens.push({ kind: "string", value: str })
            i = j + 1
            continue
        }
        if (ch >= "0" && ch <= "9") {
            let j = i
            while (
                j < input.length &&
                ((input[j] >= "0" && input[j] <= "9") || input[j] === ".")
            ) {
                j++
            }
            tokens.push({ kind: "number", value: input.slice(i, j) })
            i = j
            continue
        }
        if (/[A-Za-z_$]/.test(ch)) {
            let j = i + 1
            while (j < input.length && /[A-Za-z0-9_$]/.test(input[j])) {
                j++
            }
            tokens.push({ kind: "ident", value: input.slice(i, j) })
            i = j
            continue
        }
        let matched: Operator | undefined
        for (const op of OPERATORS) {
            if (input.startsWith(op, i)) {
                matched = op
                break
            }
        }
        if (matched) {
            tokens.push({ kind: "op", value: matched })
            i += matched.length
            continue
        }
        throw new ConditionSyntaxError(
            `Unexpected character '${ch}' at position ${i}`
        )
    }
    return tokens
}

type Node =
    | { type: "literal"; value: unknown }
    | { type: "ident"; name: string }
    | { type: "unary"; op: "!"; arg: Node }
    | { type: "binary"; op: Operator; left: Node; right: Node }

/**
 * Recursive-descent parser building the AST from {@link tokenize}'s output.
 * Operator precedence (low to high): `||` < `&&` < equality (`===`/`!==`/
 * `==`/`!=`) < unary `!` < primaries (literals, identifiers, parens).
 * Anything that doesn't fit the grammar (calls, dots, ternary, regex,
 * commas, …) is rejected because there is no production that accepts it.
 */
class Parser {
    private pos = 0
    /** @param tokens Token list produced by {@link tokenize}. */
    constructor(private readonly tokens: Token[]) {}

    /**
     * Parse the full token stream and require it to be consumed.
     *
     * @returns The expression's AST root.
     * @throws {ConditionSyntaxError} On a stray trailing token or any
     *   ungrammatical construct.
     */
    parse(): Node {
        const node = this.parseOr()
        if (this.pos < this.tokens.length) {
            throw new ConditionSyntaxError(
                `Unexpected token '${this.tokens[this.pos].value}'`
            )
        }
        return node
    }

    /** OR-precedence layer (lowest binary precedence). @returns Subtree root. */
    private parseOr(): Node {
        let left = this.parseAnd()
        while (this.peekOp("||")) {
            this.pos++
            left = { type: "binary", op: "||", left, right: this.parseAnd() }
        }
        return left
    }

    /** AND-precedence layer. @returns Subtree root. */
    private parseAnd(): Node {
        let left = this.parseEquality()
        while (this.peekOp("&&")) {
            this.pos++
            left = {
                type: "binary",
                op: "&&",
                left,
                right: this.parseEquality(),
            }
        }
        return left
    }

    /** Equality-operator precedence layer. @returns Subtree root. */
    private parseEquality(): Node {
        let left = this.parseUnary()
        while (
            this.peekOp("===") ||
            this.peekOp("!==") ||
            this.peekOp("==") ||
            this.peekOp("!=")
        ) {
            const op = this.tokens[this.pos].value as Operator
            this.pos++
            left = { type: "binary", op, left, right: this.parseUnary() }
        }
        return left
    }

    /** Unary `!` precedence layer (right-associative). @returns Subtree root. */
    private parseUnary(): Node {
        if (this.peekOp("!")) {
            this.pos++
            return { type: "unary", op: "!", arg: this.parseUnary() }
        }
        return this.parsePrimary()
    }

    /**
     * Parse a literal, identifier, or parenthesized subexpression.
     *
     * @returns The atomic AST node.
     * @throws {ConditionSyntaxError} On end-of-stream, unbalanced parens, or
     *   any token kind that has no atomic production.
     */
    private parsePrimary(): Node {
        const tok = this.tokens[this.pos]
        if (!tok) {
            throw new ConditionSyntaxError("Unexpected end of expression")
        }
        if (tok.kind === "lparen") {
            this.pos++
            const node = this.parseOr()
            const close = this.tokens[this.pos]
            if (!close || close.kind !== "rparen") {
                throw new ConditionSyntaxError("Missing closing parenthesis")
            }
            this.pos++
            return node
        }
        if (tok.kind === "string") {
            this.pos++
            return { type: "literal", value: tok.value }
        }
        if (tok.kind === "number") {
            this.pos++
            return { type: "literal", value: Number(tok.value) }
        }
        if (tok.kind === "ident") {
            this.pos++
            if (tok.value === "true") return { type: "literal", value: true }
            if (tok.value === "false")
                return { type: "literal", value: false }
            if (tok.value === "null") return { type: "literal", value: null }
            if (tok.value === "undefined")
                return { type: "literal", value: undefined }
            return { type: "ident", name: tok.value }
        }
        throw new ConditionSyntaxError(
            `Unexpected token '${tok.value}'`
        )
    }

    /**
     * @param op Operator literal to test against the lookahead token.
     * @returns `true` if the next token is exactly this operator.
     */
    private peekOp(op: Operator): boolean {
        const tok = this.tokens[this.pos]
        return tok !== undefined && tok.kind === "op" && tok.value === op
    }
}

/**
 * Evaluate the parsed AST against `ctx`. Identifier lookups use plain
 * property access on `ctx`, so prototype-chain identifiers (e.g.
 * `toString`) resolve normally — that's by design; the *parse* step is what
 * blocks dangerous shapes, not the eval step.
 *
 * @param node Subtree to evaluate.
 * @param ctx Lookup table for identifier nodes.
 * @returns The expression value, untruthified — boolean coercion happens in
 *   {@link evalCondition}.
 */
function evalNode(node: Node, ctx: Record<string, unknown>): unknown {
    switch (node.type) {
        case "literal":
            return node.value
        case "ident":
            return ctx[node.name]
        case "unary":
            return !evalNode(node.arg, ctx)
        case "binary": {
            const l = evalNode(node.left, ctx)
            switch (node.op) {
                case "&&":
                    return l && evalNode(node.right, ctx)
                case "||":
                    return l || evalNode(node.right, ctx)
                case "===":
                    return l === evalNode(node.right, ctx)
                case "!==":
                    return l !== evalNode(node.right, ctx)
                case "==":
                    return l == evalNode(node.right, ctx)
                case "!=":
                    return l != evalNode(node.right, ctx)
                default:
                    throw new ConditionSyntaxError(
                        `Unknown operator '${node.op}'`
                    )
            }
        }
    }
}

/**
 * Evaluate `expression` against `context` and coerce the result to a
 * boolean. Used by `conditional` components to choose the `then` / `else`
 * branch.
 *
 * @param expression Source supplied verbatim from `commands.json`.
 * @param context Merged `{ ...argv, ...variables }` lookup table.
 * @returns `true` if the expression evaluates truthy, `false` otherwise.
 * @throws {ConditionSyntaxError} If the expression contains anything outside
 *   the safelist (calls, property access, assignment, `new`, ternary,
 *   regex, comma, etc.).
 */
export function evalCondition(
    expression: string,
    context: Record<string, unknown>
): boolean {
    const tokens = tokenize(expression)
    const ast = new Parser(tokens).parse()
    return Boolean(evalNode(ast, context))
}
