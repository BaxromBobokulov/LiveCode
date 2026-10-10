import { CodeError, UnsupportedConstructError } from './errors'
import { tokenize, type Token } from './lexer'

// ---------------------------------------------------------------------------
// AST — every node carries the 1-based source line it came from.
// ---------------------------------------------------------------------------

export type NumType = 'int' | 'float'

export type BinaryOp = '||' | '&&' | '==' | '!=' | '<' | '>' | '<=' | '>=' | '+' | '-' | '*' | '/' | '%'

export type Expr =
  | { kind: 'number'; line: number; type: NumType; value: number }
  | { kind: 'var'; line: number; name: string }
  | { kind: 'index'; line: number; name: string; index: Expr }
  | { kind: 'unary'; line: number; op: '-' | '!'; operand: Expr }
  | { kind: 'binary'; line: number; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'call'; line: number; name: string; args: Expr[] }

/** Something that can be assigned to: `x` or `arr[i]`. */
export type Target = Extract<Expr, { kind: 'var' | 'index' }>

export type Declarator = {
  line: number
  name: string
  isArray: boolean
  /** Array size from `arr[size]`, or null for `arr[]` / plain variables. */
  size: Expr | null
  /** `= value` for a plain variable. */
  init: Expr | null
  /** `= {a, b, c}` for an array. */
  arrayInit: Expr[] | null
}

/** A printf argument: a value, or a text string for %s. */
export type PrintfArg = Expr | { kind: 'text'; line: number; value: string }

export type Stmt =
  | { kind: 'declare'; line: number; type: NumType; declarators: Declarator[] }
  | { kind: 'assign'; line: number; target: Target; op: '=' | '+=' | '-=' | '*=' | '/=' | '%='; value: Expr }
  | { kind: 'update'; line: number; target: Target; op: '++' | '--' }
  | { kind: 'expr'; line: number; expr: Expr }
  | { kind: 'printf'; line: number; format: string; args: PrintfArg[] }
  | { kind: 'if'; line: number; cond: Expr; then: Stmt; otherwise: Stmt | null }
  | { kind: 'while'; line: number; cond: Expr; body: Stmt }
  | { kind: 'for'; line: number; init: Stmt | null; cond: Expr | null; update: Stmt | null; body: Stmt }
  | { kind: 'return'; line: number; value: Expr | null }
  | { kind: 'block'; line: number; body: Stmt[] }

export type Param = { name: string; type: NumType; isArray: boolean }

export type FunctionDecl = {
  name: string
  returnType: NumType | 'void'
  params: Param[]
  body: Stmt[]
  /** Line of the function header. */
  line: number
  /** Line of the closing brace. */
  endLine: number
}

export type Program = { functions: Map<string, FunctionDecl> }

// ---------------------------------------------------------------------------
// Printing expressions back as source text (used by the explanations)
// ---------------------------------------------------------------------------

const precedence: Record<string, number> = {
  '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6,
}

/** Whether `child` needs parentheses when printed as an operand of `parentOp`. */
export function needsParens(child: Expr, parentOp: BinaryOp, isRight: boolean): boolean {
  if (child.kind !== 'binary') return false
  const childPrec = precedence[child.op]
  const parentPrec = precedence[parentOp]
  return childPrec < parentPrec || (isRight && childPrec === parentPrec)
}

/** Prints an expression the way it would be written in C, e.g. "sum + arr[i]". */
export function toSource(expr: Expr): string {
  switch (expr.kind) {
    case 'number':
      return formatNumber(expr.value, expr.type)
    case 'var':
      return expr.name
    case 'index':
      return `${expr.name}[${toSource(expr.index)}]`
    case 'unary': {
      const operand = toSource(expr.operand)
      return expr.operand.kind === 'binary' ? `${expr.op}(${operand})` : `${expr.op}${operand}`
    }
    case 'binary': {
      const left = toSource(expr.left)
      const right = toSource(expr.right)
      return `${needsParens(expr.left, expr.op, false) ? `(${left})` : left} ${expr.op} ${
        needsParens(expr.right, expr.op, true) ? `(${right})` : right
      }`
    }
    case 'call':
      return `${expr.name}(${expr.args.map(toSource).join(', ')})`
  }
}

/** Formats a number for display: ints as-is, floats always with a decimal point ("2.0", "3.14"). */
export function formatNumber(value: number, type: NumType): string {
  if (type === 'int') return String(value)
  if (!Number.isFinite(value)) return String(value)
  const text = String(Number(value.toPrecision(7)))
  return /[.e]/.test(text) ? text : `${text}.0`
}

// ---------------------------------------------------------------------------
// Unsupported constructs
// ---------------------------------------------------------------------------

const unsupportedKeywords: Record<string, [construct: string, message: string]> = {
  char: ['char', 'The char type (characters and strings) is not supported yet. Use int or float.'],
  double: ['double', 'The double type is not supported yet. Use float instead.'],
  long: ['long', 'Only the int and float types are supported.'],
  short: ['short', 'Only the int and float types are supported.'],
  unsigned: ['unsigned', 'Only the int and float types are supported.'],
  signed: ['signed', 'Only the int and float types are supported.'],
  struct: ['struct', 'Structs are not supported yet.'],
  union: ['union', 'Unions are not supported yet.'],
  enum: ['enum', 'Enums are not supported yet.'],
  typedef: ['typedef', 'typedef is not supported yet.'],
  do: ['do-while loop', 'do-while loops are not supported yet. Use a while loop instead.'],
  switch: ['switch statement', 'switch statements are not supported yet. Use if / else if instead.'],
  case: ['switch statement', 'switch statements are not supported yet. Use if / else if instead.'],
  default: ['switch statement', 'switch statements are not supported yet. Use if / else if instead.'],
  break: ['break', 'break is not supported yet. End the loop through its condition instead.'],
  continue: ['continue', 'continue is not supported yet.'],
  goto: ['goto', 'goto is not supported.'],
  sizeof: ['sizeof', 'sizeof is not supported yet.'],
  const: ['const', 'Qualifiers like const are not supported yet. Remove it.'],
  static: ['static', 'Qualifiers like static are not supported yet. Remove it.'],
  extern: ['extern', 'extern is not supported. Everything must be in this one file.'],
  volatile: ['volatile', 'Qualifiers like volatile are not supported yet. Remove it.'],
  register: ['register', 'Qualifiers like register are not supported yet. Remove it.'],
  auto: ['auto', 'Qualifiers like auto are not supported yet. Remove it.'],
}

// Operators that can show up after a value but are outside the supported subset.
const unsupportedOperators: Record<string, [construct: string, message: string]> = {
  '&': ['bitwise operator &', 'Bitwise operators are not supported yet. Did you mean && ?'],
  '|': ['bitwise operator |', 'Bitwise operators are not supported yet. Did you mean || ?'],
  '^': ['bitwise operator ^', 'Bitwise operators are not supported yet.'],
  '<<': ['bitwise operator <<', 'Bitwise operators are not supported yet.'],
  '>>': ['bitwise operator >>', 'Bitwise operators are not supported yet.'],
  '?': ['ternary operator ?:', 'The ?: operator is not supported yet. Use if / else instead.'],
  '->': ['pointer member access ->', 'Pointers and structs are not supported yet.'],
  '.': ['struct member access', 'Structs are not supported yet.'],
}

const assignmentOps = ['=', '+=', '-=', '*=', '/=', '%=']
const bitwiseAssignmentOps = ['&=', '|=', '^=', '<<=', '>>=']

function rejectUnsupportedKeyword(token: Token) {
  if (token.kind !== 'keyword') return
  const entry = unsupportedKeywords[token.text]
  if (entry) throw new UnsupportedConstructError(token.line, entry[0], entry[1])
}

function rejectUnsupportedOperator(token: Token) {
  if (token.kind !== 'punct') return
  const entry = unsupportedOperators[token.text]
  if (entry) throw new UnsupportedConstructError(token.line, entry[0], entry[1])
  if (assignmentOps.includes(token.text) || token.text === '++' || token.text === '--') {
    throw new UnsupportedConstructError(
      token.line,
      `${token.text} inside an expression`,
      `Assignments like ${token.text} must be a statement of their own, e.g. "x = x + 1;".`,
    )
  }
  if (bitwiseAssignmentOps.includes(token.text)) {
    throw new UnsupportedConstructError(token.line, `bitwise operator ${token.text}`, 'Bitwise operators are not supported yet.')
  }
}

function pointerError(line: number): UnsupportedConstructError {
  return new UnsupportedConstructError(line, 'pointer', 'Pointers are not supported yet.')
}

function describe(token: Token): string {
  if (token.kind === 'eof') return 'the end of the file'
  if (token.kind === 'string') return 'a string'
  return `"${token.text}"`
}

// ---------------------------------------------------------------------------
// Recursive-descent parser
// ---------------------------------------------------------------------------

/** Parses a whole C program. Throws CodeError or UnsupportedConstructError. */
export function parse(source: string): Program {
  const tokens = tokenize(source)
  let pos = 0

  const peek = (offset = 0) => tokens[Math.min(pos + offset, tokens.length - 1)]
  const advance = () => tokens[Math.min(pos++, tokens.length - 1)]
  /** Is the token at `offset` the punctuator or keyword `text`? */
  const is = (text: string, offset = 0) => {
    const token = peek(offset)
    return (token.kind === 'punct' || token.kind === 'keyword') && token.text === text
  }
  const accept = (text: string) => {
    if (!is(text)) return false
    pos++
    return true
  }
  const isType = (offset = 0) => is('int', offset) || is('float', offset)

  function expect(text: string): Token {
    if (is(text)) return advance()
    const token = peek()
    rejectUnsupportedKeyword(token)
    rejectUnsupportedOperator(token)
    if (text === ';' && token.text === ',') {
      throw new UnsupportedConstructError(token.line, 'comma operator', 'The comma operator is not supported yet. Use separate statements.')
    }
    // A missing ";" belongs to the line before the next token.
    const line = text === ';' && pos > 0 ? tokens[pos - 1].line : token.line
    throw new CodeError(line, `Expected "${text}" but found ${describe(token)}.`)
  }

  function expectIdentifier(): Token {
    const token = peek()
    if (token.kind === 'identifier') return advance()
    if (token.text === '*') throw pointerError(token.line)
    rejectUnsupportedKeyword(token)
    throw new CodeError(token.line, `Expected a name but found ${describe(token)}.`)
  }

  // ----- Top level: function definitions only -----

  const functions = new Map<string, FunctionDecl>()

  while (peek().kind !== 'eof') {
    const token = peek()
    rejectUnsupportedKeyword(token)
    if (!isType() && !is('void')) {
      throw new CodeError(token.line, `Expected a function like "int main() {" but found ${describe(token)}.`)
    }
    const returnType = advance().text as NumType | 'void'
    if (is('*')) throw pointerError(peek().line)
    const nameToken = expectIdentifier()

    if (!is('(')) {
      throw new UnsupportedConstructError(
        nameToken.line,
        'global variable',
        `Global variables are not supported yet. Declare ${nameToken.text} inside a function.`,
      )
    }

    const params = parseParams()
    if (accept(';')) continue // A prototype like "int add(int a, int b);" — the definition comes later.

    if (nameToken.text === 'main' && params.length > 0) {
      throw new UnsupportedConstructError(nameToken.line, 'main with parameters', 'main() with parameters (argc, argv) is not supported. Use int main().')
    }
    if (functions.has(nameToken.text)) {
      throw new CodeError(nameToken.line, `The function ${nameToken.text} is defined twice.`)
    }

    expect('{')
    const body = parseStatementsUntilBrace()
    const endLine = expect('}').line
    functions.set(nameToken.text, { name: nameToken.text, returnType, params, body, line: nameToken.line, endLine })
  }

  if (!functions.has('main')) {
    throw new CodeError(tokens[pos].line, 'The program needs a main function: int main() { ... }')
  }

  return { functions }

  function parseParams(): Param[] {
    expect('(')
    const params: Param[] = []
    if (is('void') && is(')', 1)) advance()
    while (!is(')')) {
      if (params.length > 0) expect(',')
      const typeToken = peek()
      rejectUnsupportedKeyword(typeToken)
      if (!isType()) throw new CodeError(typeToken.line, `Expected a parameter type (int or float) but found ${describe(typeToken)}.`)
      const type = advance().text as NumType
      if (is('*')) throw pointerError(peek().line)
      // Names are optional in prototypes: "int add(int, int);"
      const name = peek().kind === 'identifier' ? advance().text : ''
      let isArray = false
      if (accept('[')) {
        if (peek().kind === 'number') advance()
        expect(']')
        isArray = true
        if (is('[')) throw twoDimensionalError(peek().line)
      }
      params.push({ name, type, isArray })
    }
    expect(')')
    return params
  }

  // ----- Statements -----

  function parseStatementsUntilBrace(): Stmt[] {
    const body: Stmt[] = []
    while (!is('}')) {
      if (peek().kind === 'eof') throw new CodeError(peek().line, 'A "{" is never closed. Add the missing "}".')
      body.push(parseStatement())
    }
    return body
  }

  function parseStatement(): Stmt {
    const token = peek()
    const line = token.line
    rejectUnsupportedKeyword(token)

    if (accept('{')) {
      const body = parseStatementsUntilBrace()
      expect('}')
      return { kind: 'block', line, body }
    }
    if (accept(';')) return { kind: 'block', line, body: [] }
    if (isType()) return parseDeclaration()
    if (is('void')) throw new CodeError(line, 'A variable cannot have the type void.')

    if (accept('if')) {
      expect('(')
      const cond = parseExpression()
      expect(')')
      const then = parseStatement()
      let otherwise: Stmt | null = null
      if (accept('else')) otherwise = parseStatement()
      return { kind: 'if', line, cond, then, otherwise }
    }

    if (accept('while')) {
      expect('(')
      const cond = parseExpression()
      expect(')')
      return { kind: 'while', line, cond, body: parseStatement() }
    }

    if (accept('for')) {
      expect('(')
      let init: Stmt | null = null
      if (isType()) {
        init = parseDeclaration() // consumes the ";"
      } else {
        if (!is(';')) init = parseSimpleStatement()
        expect(';')
      }
      const cond = is(';') ? null : parseExpression()
      expect(';')
      const update = is(')') ? null : parseSimpleStatement()
      expect(')')
      return { kind: 'for', line, init, cond, update, body: parseStatement() }
    }

    if (accept('return')) {
      const value = is(';') ? null : parseExpression()
      expect(';')
      return { kind: 'return', line, value }
    }

    if (is('else')) throw new CodeError(line, 'This else has no matching if before it.')

    if (token.kind === 'identifier' && token.text === 'printf' && is('(', 1)) return parsePrintf()

    const statement = parseSimpleStatement()
    expect(';')
    return statement
  }

  /** `int x = 1, arr[3] = {1, 2, 3};` — including the final ";". */
  function parseDeclaration(): Stmt {
    const typeToken = advance()
    const type = typeToken.text as NumType
    const declarators: Declarator[] = []

    do {
      if (is('*')) throw pointerError(peek().line)
      const nameToken = expectIdentifier()
      if (is('(')) {
        throw new CodeError(nameToken.line, `Functions must be defined outside of other functions. Move ${nameToken.text} out of this one.`)
      }

      const declarator: Declarator = { line: nameToken.line, name: nameToken.text, isArray: false, size: null, init: null, arrayInit: null }
      if (accept('[')) {
        declarator.isArray = true
        if (!is(']')) declarator.size = parseExpression()
        expect(']')
        if (is('[')) throw twoDimensionalError(peek().line)
      }

      if (accept('=')) {
        if (declarator.isArray) {
          if (peek().kind === 'string') throw stringError(peek().line)
          expect('{')
          const values: Expr[] = []
          while (!is('}')) {
            if (values.length > 0) expect(',')
            if (is('}')) break // trailing comma
            values.push(parseExpression())
          }
          expect('}')
          declarator.arrayInit = values
        } else {
          if (is('{')) throw new CodeError(peek().line, `${nameToken.text} is not an array, so it can't be set to a { ... } list.`)
          declarator.init = parseExpression()
        }
      }

      if (declarator.isArray && !declarator.size && !declarator.arrayInit) {
        throw new CodeError(nameToken.line, `The array ${nameToken.text} needs a size, e.g. ${nameToken.text}[5].`)
      }
      declarators.push(declarator)
    } while (accept(','))

    expect(';')
    return { kind: 'declare', line: typeToken.line, type, declarators }
  }

  /** An assignment (`x = 1`, `arr[i] += 2`), an increment (`i++`), or a plain expression — without the ";". */
  function parseSimpleStatement(): Stmt {
    const line = peek().line

    if (is('++') || is('--')) {
      const op = advance().text as '++' | '--'
      return { kind: 'update', line, target: parseTarget(), op }
    }

    if (peek().kind === 'identifier' && !is('(', 1)) {
      const start = pos
      const target = parseTarget()
      if (is('++') || is('--')) return { kind: 'update', line, target, op: advance().text as '++' | '--' }
      if (peek().kind === 'punct' && assignmentOps.includes(peek().text)) {
        const op = advance().text as Extract<Stmt, { kind: 'assign' }>['op']
        return { kind: 'assign', line, target, op, value: parseExpression() }
      }
      if (peek().kind === 'punct' && bitwiseAssignmentOps.includes(peek().text)) rejectUnsupportedOperator(peek())
      pos = start // Not an assignment after all; read it as an expression.
    }

    return { kind: 'expr', line, expr: parseExpression() }
  }

  /** `x` or `arr[i]` on the left of an assignment. */
  function parseTarget(): Target {
    const nameToken = expectIdentifier()
    if (!accept('[')) return { kind: 'var', line: nameToken.line, name: nameToken.text }
    const index = parseExpression()
    expect(']')
    if (is('[')) throw twoDimensionalError(peek().line)
    return { kind: 'index', line: nameToken.line, name: nameToken.text, index }
  }

  function parsePrintf(): Stmt {
    const line = advance().line // printf
    expect('(')
    const formatToken = peek()
    if (formatToken.kind !== 'string') {
      throw new CodeError(formatToken.line, 'printf needs a text string first, e.g. printf("x = %d\\n", x).')
    }
    advance()

    const args: PrintfArg[] = []
    while (accept(',')) {
      const token = peek()
      if (token.kind === 'string') {
        advance()
        args.push({ kind: 'text', line: token.line, value: token.text })
      } else {
        args.push(parseExpression())
      }
    }
    expect(')')
    expect(';')

    const specifiers = readFormatSpecifiers(formatToken.text, line)
    if (specifiers.length !== args.length) {
      throw new CodeError(
        line,
        `The printf text has ${specifiers.length} placeholder(s) (%d, %f, %s) but ${args.length} value(s) were given.`,
      )
    }
    specifiers.forEach((specifier, i) => {
      const isText = args[i].kind === 'text'
      if (specifier === 's' && !isText) throw new CodeError(line, '%s needs a text string like "hello". Use %d or %f for numbers.')
      if (specifier !== 's' && isText) throw new CodeError(line, `%${specifier} needs a number, but a text string was given. Use %s for text.`)
    })

    return { kind: 'printf', line, format: formatToken.text, args }
  }

  // ----- Expressions (precedence climbing) -----

  function parseExpression(): Expr {
    return parseBinary(1)
  }

  function parseBinary(minPrecedence: number): Expr {
    let left = parseUnary()
    for (;;) {
      const token = peek()
      rejectUnsupportedOperator(token)
      const prec = token.kind === 'punct' ? precedence[token.text] : undefined
      if (prec === undefined || prec < minPrecedence) return left
      advance()
      const right = parseBinary(prec + 1)
      left = { kind: 'binary', line: token.line, op: token.text as BinaryOp, left, right }
    }
  }

  function parseUnary(): Expr {
    const token = peek()
    if (token.kind === 'punct') {
      if (token.text === '-' || token.text === '!') {
        advance()
        return { kind: 'unary', line: token.line, op: token.text, operand: parseUnary() }
      }
      if (token.text === '+') {
        advance()
        return parseUnary()
      }
      if (token.text === '*' || token.text === '&') throw pointerError(token.line)
      if (token.text === '~') throw new UnsupportedConstructError(token.line, 'bitwise operator ~', 'Bitwise operators are not supported yet.')
      if (token.text === '++' || token.text === '--') rejectUnsupportedOperator(token)
    }
    return parsePrimary()
  }

  function parsePrimary(): Expr {
    const token = peek()

    if (token.kind === 'number') {
      advance()
      const isFloat = /[.eEfF]/.test(token.text)
      return { kind: 'number', line: token.line, type: isFloat ? 'float' : 'int', value: parseFloat(token.text) }
    }

    if (token.kind === 'identifier') {
      advance()
      if (accept('(')) {
        if (token.text === 'printf') {
          throw new UnsupportedConstructError(token.line, 'printf inside an expression', 'printf must be a statement of its own.')
        }
        const args: Expr[] = []
        while (!is(')')) {
          if (args.length > 0) expect(',')
          if (peek().kind === 'string') throw stringError(peek().line)
          args.push(parseExpression())
        }
        expect(')')
        return { kind: 'call', line: token.line, name: token.text, args }
      }
      if (accept('[')) {
        const index = parseExpression()
        expect(']')
        if (is('[')) throw twoDimensionalError(peek().line)
        return { kind: 'index', line: token.line, name: token.text, index }
      }
      return { kind: 'var', line: token.line, name: token.text }
    }

    if (accept('(')) {
      if (isType() || peek().kind === 'keyword') {
        rejectUnsupportedKeyword(peek())
        throw new UnsupportedConstructError(token.line, 'type cast', 'Type casts like (float)x are not supported yet.')
      }
      const expr = parseExpression()
      expect(')')
      return expr
    }

    if (token.kind === 'string') throw stringError(token.line)
    if (token.kind === 'char') {
      throw new UnsupportedConstructError(token.line, `character ${token.text}`, 'Characters (char) are not supported yet. Use int or float.')
    }
    rejectUnsupportedKeyword(token)
    rejectUnsupportedOperator(token)
    throw new CodeError(token.line, `Expected a value but found ${describe(token)}.`)
  }
}

/** Returns the conversion letters in a printf format ("d", "f", "s"), rejecting any others. */
function readFormatSpecifiers(format: string, line: number): string[] {
  const specifiers: string[] = []
  for (let i = 0; i < format.length; i++) {
    if (format[i] !== '%') continue
    if (format[i + 1] === '%') {
      i++
      continue
    }
    // Read up to the conversion letter so "%.2f" or "%5d" is reported as a whole.
    const match = /^%[^A-Za-z%]*[A-Za-z]?/.exec(format.slice(i))
    const placeholder = match ? match[0] : '%'
    if (placeholder !== '%d' && placeholder !== '%f' && placeholder !== '%s') {
      throw new UnsupportedConstructError(
        line,
        `printf placeholder ${placeholder}`,
        `The printf placeholder ${placeholder} is not supported yet. Only %d, %f and %s work.`,
      )
    }
    specifiers.push(placeholder[1])
    i += placeholder.length - 1
  }
  return specifiers
}

function twoDimensionalError(line: number): UnsupportedConstructError {
  return new UnsupportedConstructError(line, '2D array', 'Arrays with more than one dimension are not supported yet.')
}

function stringError(line: number): UnsupportedConstructError {
  return new UnsupportedConstructError(line, 'string', 'Text strings can only be used directly inside printf.')
}
