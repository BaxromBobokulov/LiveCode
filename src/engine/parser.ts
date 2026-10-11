import { CodeError, UnsupportedConstructError, code, type ErrorText } from './errors'
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
  /** One cell of a 2D array: `grid[row][col]`. */
  | { kind: 'cell'; line: number; name: string; row: Expr; col: Expr }
  | { kind: 'unary'; line: number; op: '-' | '!'; operand: Expr }
  | { kind: 'binary'; line: number; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'call'; line: number; name: string; args: Expr[] }

/** Something that can be assigned to: `x`, `arr[i]` or `grid[i][j]`. */
export type Target = Extract<Expr, { kind: 'var' | 'index' | 'cell' }>

export type Declarator = {
  line: number
  name: string
  isArray: boolean
  /** Array size from `arr[size]` (the row count for `grid[rows][cols]`), or null for `arr[]` / plain variables. */
  size: Expr | null
  /** Column count from `grid[rows][cols]`. Only set for a 2D array. */
  columns: Expr | null
  /** `= value` for a plain variable. */
  init: Expr | null
  /** `= {a, b, c}` for a 1D array. */
  arrayInit: Expr[] | null
  /** `= {{a, b}, {c, d}}` for a 2D array, one list per row. */
  gridInit: Expr[][] | null
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

export type Param = {
  name: string
  type: NumType
  isArray: boolean
  /** Column count of a 2D array parameter, e.g. 3 in `int grid[][3]`; null otherwise. */
  columns: number | null
}

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
    case 'cell':
      return `${expr.name}[${toSource(expr.row)}][${toSource(expr.col)}]`
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

const onlyIntFloat: ErrorText = { key: 'unsupported.onlyIntFloat' }
const switchStatement: [ErrorText, ErrorText] = [{ key: 'construct.switch' }, { key: 'unsupported.switch' }]
const qualifier = (keyword: string): [ErrorText, ErrorText] => [code(keyword), { key: 'unsupported.qualifier', values: { keyword } }]
const notYet = (keyword: string): [ErrorText, ErrorText] => [code(keyword), { key: 'unsupported.keyword', values: { keyword } }]

const unsupportedKeywords: Record<string, [construct: ErrorText, message: ErrorText]> = {
  char: [code('char'), { key: 'unsupported.charType' }],
  double: [code('double'), { key: 'unsupported.doubleType' }],
  long: [code('long'), onlyIntFloat],
  short: [code('short'), onlyIntFloat],
  unsigned: [code('unsigned'), onlyIntFloat],
  signed: [code('signed'), onlyIntFloat],
  struct: [code('struct'), { key: 'unsupported.struct' }],
  union: [code('union'), { key: 'unsupported.union' }],
  enum: [code('enum'), { key: 'unsupported.enum' }],
  typedef: notYet('typedef'),
  do: [{ key: 'construct.doWhile' }, { key: 'unsupported.doWhile' }],
  switch: switchStatement,
  case: switchStatement,
  default: switchStatement,
  break: [code('break'), { key: 'unsupported.break' }],
  continue: notYet('continue'),
  goto: [code('goto'), { key: 'unsupported.goto' }],
  sizeof: notYet('sizeof'),
  const: qualifier('const'),
  static: qualifier('static'),
  extern: [code('extern'), { key: 'unsupported.extern' }],
  volatile: qualifier('volatile'),
  register: qualifier('register'),
  auto: qualifier('auto'),
}

const bitwise = (op: string, message: ErrorText = { key: 'unsupported.bitwise' }): [ErrorText, ErrorText] => [
  { key: 'construct.bitwise', values: { op } },
  message,
]

// Operators that can show up after a value but are outside the supported subset.
const unsupportedOperators: Record<string, [construct: ErrorText, message: ErrorText]> = {
  '&': bitwise('&', { key: 'unsupported.bitwiseDidYouMean', values: { suggestion: '&&' } }),
  '|': bitwise('|', { key: 'unsupported.bitwiseDidYouMean', values: { suggestion: '||' } }),
  '^': bitwise('^'),
  '<<': bitwise('<<'),
  '>>': bitwise('>>'),
  '?': [{ key: 'construct.ternary' }, { key: 'unsupported.ternary' }],
  '->': [{ key: 'construct.arrow' }, { key: 'unsupported.pointersStructs' }],
  '.': [{ key: 'construct.structMember' }, { key: 'unsupported.struct' }],
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
    const values = { op: token.text }
    throw new UnsupportedConstructError(
      token.line,
      { key: 'construct.assignInExpr', values },
      { key: 'unsupported.assignInExpr', values },
    )
  }
  if (bitwiseAssignmentOps.includes(token.text)) {
    throw new UnsupportedConstructError(token.line, ...bitwise(token.text))
  }
}

function pointerError(line: number): UnsupportedConstructError {
  return new UnsupportedConstructError(line, { key: 'construct.pointer' }, { key: 'unsupported.pointer' })
}

function describe(token: Token): ErrorText {
  if (token.kind === 'eof') return { key: 'found.eof' }
  if (token.kind === 'string') return { key: 'found.string' }
  return { key: 'found.token', values: { text: token.text } }
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
      throw new UnsupportedConstructError(token.line, { key: 'construct.comma' }, { key: 'unsupported.comma' })
    }
    // A missing ";" belongs to the line before the next token.
    const line = text === ';' && pos > 0 ? tokens[pos - 1].line : token.line
    throw new CodeError(line, 'codeError.expected', { text, found: describe(token) })
  }

  function expectIdentifier(): Token {
    const token = peek()
    if (token.kind === 'identifier') return advance()
    if (token.text === '*') throw pointerError(token.line)
    rejectUnsupportedKeyword(token)
    throw new CodeError(token.line, 'codeError.expectedName', { found: describe(token) })
  }

  // ----- Top level: function definitions only -----

  const functions = new Map<string, FunctionDecl>()

  while (peek().kind !== 'eof') {
    const token = peek()
    rejectUnsupportedKeyword(token)
    if (!isType() && !is('void')) {
      throw new CodeError(token.line, 'codeError.expectedFunction', { found: describe(token) })
    }
    const returnType = advance().text as NumType | 'void'
    if (is('*')) throw pointerError(peek().line)
    const nameToken = expectIdentifier()

    if (!is('(')) {
      throw new UnsupportedConstructError(
        nameToken.line,
        { key: 'construct.globalVariable' },
        { key: 'unsupported.globalVariable', values: { name: nameToken.text } },
      )
    }

    const params = parseParams()
    if (accept(';')) continue // A prototype like "int add(int a, int b);" — the definition comes later.

    if (nameToken.text === 'main' && params.length > 0) {
      throw new UnsupportedConstructError(nameToken.line, { key: 'construct.mainParams' }, { key: 'unsupported.mainParams' })
    }
    if (functions.has(nameToken.text)) {
      throw new CodeError(nameToken.line, 'codeError.definedTwice', { name: nameToken.text })
    }

    expect('{')
    const body = parseStatementsUntilBrace()
    const endLine = expect('}').line
    functions.set(nameToken.text, { name: nameToken.text, returnType, params, body, line: nameToken.line, endLine })
  }

  if (!functions.has('main')) {
    throw new CodeError(tokens[pos].line, 'codeError.noMain')
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
      if (!isType()) throw new CodeError(typeToken.line, 'codeError.expectedParamType', { found: describe(typeToken) })
      const type = advance().text as NumType
      if (is('*')) throw pointerError(peek().line)
      // Names are optional in prototypes: "int add(int, int);"
      const name = peek().kind === 'identifier' ? advance().text : ''
      let isArray = false
      let columns: number | null = null
      if (accept('[')) {
        if (peek().kind === 'number') advance()
        expect(']')
        isArray = true
        // A 2D parameter must say how many columns it has: int grid[][3]
        if (accept('[')) {
          const columnsToken = peek()
          if (columnsToken.kind !== 'number' || !/^\d+$/.test(columnsToken.text)) {
            throw new CodeError(columnsToken.line, 'codeError.gridParamColumns', { name: name || 'grid' })
          }
          advance()
          expect(']')
          columns = Number(columnsToken.text)
          if (is('[')) throw tooManyDimensionsError(peek().line)
        }
      }
      params.push({ name, type, isArray, columns })
    }
    expect(')')
    return params
  }

  // ----- Statements -----

  function parseStatementsUntilBrace(): Stmt[] {
    const body: Stmt[] = []
    while (!is('}')) {
      if (peek().kind === 'eof') throw new CodeError(peek().line, 'codeError.unclosedBrace')
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
    if (is('void')) throw new CodeError(line, 'codeError.voidVariable')

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

    if (is('else')) throw new CodeError(line, 'codeError.elseWithoutIf')

    if (token.kind === 'identifier' && token.text === 'printf' && is('(', 1)) return parsePrintf()

    const statement = parseSimpleStatement()
    expect(';')
    return statement
  }

  /** `int x = 1, arr[3] = {1, 2, 3}, grid[2][2] = {{1, 2}, {3, 4}};` — including the final ";". */
  function parseDeclaration(): Stmt {
    const typeToken = advance()
    const type = typeToken.text as NumType
    const declarators: Declarator[] = []

    do {
      if (is('*')) throw pointerError(peek().line)
      const nameToken = expectIdentifier()
      if (is('(')) {
        throw new CodeError(nameToken.line, 'codeError.nestedFunction', { name: nameToken.text })
      }

      const declarator: Declarator = {
        line: nameToken.line,
        name: nameToken.text,
        isArray: false,
        size: null,
        columns: null,
        init: null,
        arrayInit: null,
        gridInit: null,
      }
      if (accept('[')) {
        declarator.isArray = true
        if (!is(']')) declarator.size = parseExpression()
        expect(']')
        if (accept('[')) {
          if (is(']')) {
            throw new CodeError(peek().line, 'codeError.gridColumns', { name: nameToken.text })
          }
          declarator.columns = parseExpression()
          expect(']')
          if (is('[')) throw tooManyDimensionsError(peek().line)
        }
      }

      if (accept('=')) {
        if (declarator.isArray) {
          if (peek().kind === 'string') throw stringError(peek().line)
          if (declarator.columns) declarator.gridInit = parseGridInit(nameToken.text)
          else declarator.arrayInit = parseInitList()
        } else {
          if (is('{')) throw new CodeError(peek().line, 'codeError.notArrayInit', { name: nameToken.text })
          declarator.init = parseExpression()
        }
      }

      if (declarator.isArray && !declarator.size && !declarator.arrayInit && !declarator.gridInit) {
        throw new CodeError(nameToken.line, 'codeError.arraySize', { name: nameToken.text })
      }
      declarators.push(declarator)
    } while (accept(','))

    expect(';')
    return { kind: 'declare', line: typeToken.line, type, declarators }
  }

  /** `{a, b, c}` */
  function parseInitList(): Expr[] {
    expect('{')
    const values: Expr[] = []
    while (!is('}')) {
      if (values.length > 0) expect(',')
      if (is('}')) break // trailing comma
      values.push(parseExpression())
    }
    expect('}')
    return values
  }

  /** `{{a, b}, {c, d}}` — one braced list per row. */
  function parseGridInit(name: string): Expr[][] {
    expect('{')
    const rows: Expr[][] = []
    while (!is('}')) {
      if (rows.length > 0) expect(',')
      if (is('}')) break // trailing comma
      if (!is('{')) {
        throw new CodeError(peek().line, 'codeError.gridRows', { name })
      }
      rows.push(parseInitList())
    }
    expect('}')
    return rows
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

  /** `x`, `arr[i]` or `grid[i][j]` on the left of an assignment. */
  function parseTarget(): Target {
    const nameToken = expectIdentifier()
    if (!is('[')) return { kind: 'var', line: nameToken.line, name: nameToken.text }
    return parseIndexed(nameToken)
  }

  /** The `[i]` or `[i][j]` after an array's name. */
  function parseIndexed(nameToken: Token): Extract<Expr, { kind: 'index' | 'cell' }> {
    expect('[')
    const index = parseExpression()
    expect(']')
    if (!accept('[')) return { kind: 'index', line: nameToken.line, name: nameToken.text, index }
    const col = parseExpression()
    expect(']')
    if (is('[')) throw tooManyDimensionsError(peek().line)
    return { kind: 'cell', line: nameToken.line, name: nameToken.text, row: index, col }
  }

  function parsePrintf(): Stmt {
    const line = advance().line // printf
    expect('(')
    const formatToken = peek()
    if (formatToken.kind !== 'string') {
      throw new CodeError(formatToken.line, 'codeError.printfFormat')
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
      throw new CodeError(line, 'codeError.printfCount', { placeholders: specifiers.length, given: args.length })
    }
    specifiers.forEach((specifier, i) => {
      const isText = args[i].kind === 'text'
      if (specifier === 's' && !isText) throw new CodeError(line, 'codeError.printfS')
      if (specifier !== 's' && isText) throw new CodeError(line, 'codeError.printfNumber', { specifier: `%${specifier}` })
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
      if (token.text === '~') throw new UnsupportedConstructError(token.line, ...bitwise('~'))
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
          throw new UnsupportedConstructError(token.line, { key: 'construct.printfInExpr' }, { key: 'unsupported.printfInExpr' })
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
      if (is('[')) return parseIndexed(token)
      return { kind: 'var', line: token.line, name: token.text }
    }

    if (accept('(')) {
      if (isType() || peek().kind === 'keyword') {
        rejectUnsupportedKeyword(peek())
        throw new UnsupportedConstructError(token.line, { key: 'construct.cast' }, { key: 'unsupported.cast' })
      }
      const expr = parseExpression()
      expect(')')
      return expr
    }

    if (token.kind === 'string') throw stringError(token.line)
    if (token.kind === 'char') {
      throw new UnsupportedConstructError(token.line, { key: 'construct.char', values: { text: token.text } }, { key: 'unsupported.char' })
    }
    rejectUnsupportedKeyword(token)
    rejectUnsupportedOperator(token)
    throw new CodeError(token.line, 'codeError.expectedValue', { found: describe(token) })
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
        { key: 'construct.placeholder', values: { placeholder } },
        { key: 'unsupported.placeholder', values: { placeholder } },
      )
    }
    specifiers.push(placeholder[1])
    i += placeholder.length - 1
  }
  return specifiers
}

function tooManyDimensionsError(line: number): UnsupportedConstructError {
  return new UnsupportedConstructError(line, { key: 'construct.array3d' }, { key: 'unsupported.array3d' })
}

function stringError(line: number): UnsupportedConstructError {
  return new UnsupportedConstructError(line, { key: 'construct.string' }, { key: 'unsupported.string' })
}
