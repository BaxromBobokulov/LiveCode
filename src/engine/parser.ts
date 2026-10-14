import { CodeError, UnsupportedConstructError, code, scanfReadError } from './errors'
import { tokenize, type Token } from './lexer'
import { charText, type Phrase } from './types'

// ---------------------------------------------------------------------------
// AST — every node carries the 1-based source line it came from.
// ---------------------------------------------------------------------------

/** The value types. A char is a small whole number too: the code of one character, e.g. 65 for 'A'. */
export type NumType = 'int' | 'float' | 'char'

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
  /** A "text" literal. Only allowed where text is expected, e.g. as a printf or puts argument. */
  | { kind: 'string'; line: number; value: string }

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
  /** `= "hello"` for a char array. */
  stringInit: string | null
}

export type Stmt =
  | { kind: 'declare'; line: number; type: NumType; declarators: Declarator[] }
  | { kind: 'assign'; line: number; target: Target; op: '=' | '+=' | '-=' | '*=' | '/=' | '%='; value: Expr }
  | { kind: 'update'; line: number; target: Target; op: '++' | '--' }
  | { kind: 'expr'; line: number; expr: Expr }
  /** `isPuts` marks a `puts(...)`, which runs as `printf("%s\n", ...)` but names puts in its errors. */
  | { kind: 'printf'; line: number; format: string; args: Expr[]; isPuts?: true }
  /**
   * `scanf("%d %f", &a, &b)`: each read takes the next value from the Input field, left to right.
   * `%s` reads one word into a char array: `scanf("%s", name)`.
   */
  | { kind: 'scanf'; line: number; reads: { specifier: 'd' | 'f' | 's'; target: Target }[] }
  | { kind: 'if'; line: number; cond: Expr; then: Stmt; otherwise: Stmt | null }
  | { kind: 'while'; line: number; cond: Expr; body: Stmt }
  | { kind: 'for'; line: number; init: Stmt | null; cond: Expr | null; update: Stmt | null; body: Stmt }
  | { kind: 'return'; line: number; value: Expr | null }
  /** `break;` leaves the innermost loop; `continue;` jumps to its next check. */
  | { kind: 'break' | 'continue'; line: number }
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
    case 'string':
      return quoteText(expr.value)
  }
}

/** Text as it would be written in C, in double quotes: "hi\n". */
export function quoteText(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`
}

/** Formats a value for display: ints as-is, floats always with a decimal point ("2.0", "3.14"), chars in quotes ('A'). */
export function formatNumber(value: number, type: NumType): string {
  if (type === 'int') return String(value)
  if (type === 'char') {
    // A character that can't be written in quotes (charText gave back its code) is shown as a number.
    const text = charText(value)
    return text === String(value) ? text : `'${text}'`
  }
  if (!Number.isFinite(value)) return String(value)
  const text = String(Number(value.toPrecision(7)))
  return /[.e]/.test(text) ? text : `${text}.0`
}

// ---------------------------------------------------------------------------
// Unsupported constructs
// ---------------------------------------------------------------------------

const onlyBasicTypes: Phrase = { key: 'unsupported.onlyBasicTypes' }
const switchStatement: [Phrase, Phrase] = [{ key: 'construct.switch' }, { key: 'unsupported.switch' }]
const qualifier = (keyword: string): [Phrase, Phrase] => [code(keyword), { key: 'unsupported.qualifier', values: { keyword } }]
const notYet = (keyword: string): [Phrase, Phrase] => [code(keyword), { key: 'unsupported.keyword', values: { keyword } }]

const unsupportedKeywords: Record<string, [construct: Phrase, message: Phrase]> = {
  double: [code('double'), { key: 'unsupported.doubleType' }],
  long: [code('long'), onlyBasicTypes],
  short: [code('short'), onlyBasicTypes],
  unsigned: [code('unsigned'), onlyBasicTypes],
  signed: [code('signed'), onlyBasicTypes],
  struct: [code('struct'), { key: 'unsupported.struct' }],
  union: [code('union'), { key: 'unsupported.union' }],
  enum: [code('enum'), { key: 'unsupported.enum' }],
  typedef: notYet('typedef'),
  do: [{ key: 'construct.doWhile' }, { key: 'unsupported.doWhile' }],
  switch: switchStatement,
  case: switchStatement,
  default: switchStatement,
  goto: [code('goto'), { key: 'unsupported.goto' }],
  sizeof: notYet('sizeof'),
  const: qualifier('const'),
  static: qualifier('static'),
  extern: [code('extern'), { key: 'unsupported.extern' }],
  volatile: qualifier('volatile'),
  register: qualifier('register'),
  auto: qualifier('auto'),
}

const bitwise = (op: string, message: Phrase = { key: 'unsupported.bitwise' }): [Phrase, Phrase] => [
  { key: 'construct.bitwise', values: { op } },
  message,
]

// Operators that can show up after a value but are outside the supported subset.
const unsupportedOperators: Record<string, [construct: Phrase, message: Phrase]> = {
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

function describe(token: Token): Phrase {
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
  const isType = (offset = 0) => is('int', offset) || is('float', offset) || is('char', offset)

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
  /** How many loops the statement being parsed is inside, so a `break` outside any loop is caught. */
  let loopDepth = 0

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

    if (is('break') || is('continue')) {
      const keyword = advance().text as 'break' | 'continue'
      if (loopDepth === 0) throw new CodeError(line, 'codeError.outsideLoop', { keyword })
      expect(';')
      return { kind: keyword, line }
    }

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
      return { kind: 'while', line, cond, body: parseLoopBody() }
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
      return { kind: 'for', line, init, cond, update, body: parseLoopBody() }
    }

    if (accept('return')) {
      const value = is(';') ? null : parseExpression()
      expect(';')
      return { kind: 'return', line, value }
    }

    if (is('else')) throw new CodeError(line, 'codeError.elseWithoutIf')

    if (token.kind === 'identifier' && token.text === 'printf' && is('(', 1)) return parsePrintf()
    if (token.kind === 'identifier' && token.text === 'puts' && is('(', 1)) return parsePuts()
    if (token.kind === 'identifier' && token.text === 'scanf' && is('(', 1)) return parseScanf()

    const statement = parseSimpleStatement()
    expect(';')
    return statement
  }

  /** A loop's body, where `break` and `continue` are allowed. */
  function parseLoopBody(): Stmt {
    loopDepth++
    const body = parseStatement()
    loopDepth--
    return body
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
        stringInit: null,
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
        const name = nameToken.text
        if (peek().kind === 'string') {
          // Text goes into a 1D char array: char name[] = "hello";
          if (type !== 'char') throw new CodeError(peek().line, 'codeError.stringIntoNonChar', { name, type })
          if (!declarator.isArray) throw new CodeError(peek().line, 'codeError.stringIntoChar', { name })
          if (declarator.columns) throw stringError(peek().line)
          declarator.stringInit = advance().text
        } else if (declarator.isArray) {
          if (declarator.columns) declarator.gridInit = parseGridInit(name)
          else declarator.arrayInit = parseInitList()
        } else {
          if (is('{')) throw new CodeError(peek().line, 'codeError.notArrayInit', { name })
          declarator.init = parseExpression()
        }
      }

      const hasInit = declarator.arrayInit || declarator.gridInit || declarator.stringInit !== null
      if (declarator.isArray && !declarator.size && !hasInit) {
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
        if (peek().kind === 'string') throw new CodeError(line, 'codeError.assignString', { name: target.name })
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

    const args: Expr[] = []
    while (accept(',')) args.push(parseText())
    expect(')')
    expect(';')

    const specifiers = readFormatSpecifiers(formatToken.text, line)
    if (specifiers.length !== args.length) {
      throw new CodeError(line, 'codeError.printfCount', { placeholders: specifiers.length, given: args.length })
    }
    specifiers.forEach((specifier, i) => {
      const kind = args[i].kind
      // %s prints text: a "string" or a char array, named on its own (which one is checked when it runs).
      if (specifier === 's' && kind !== 'string' && kind !== 'var') throw new CodeError(line, 'codeError.printfS')
      if (specifier !== 's' && kind === 'string') throw new CodeError(line, 'codeError.printfNumber', { specifier: `%${specifier}` })
    })

    return { kind: 'printf', line, format: formatToken.text, args }
  }

  /** A "string" literal where text is allowed, or else an ordinary expression. */
  function parseText(): Expr {
    const token = peek()
    if (token.kind !== 'string') return parseExpression()
    advance()
    return { kind: 'string', line: token.line, value: token.text }
  }

  /**
   * `puts("text");` or `puts(name);` is read as `printf("%s\n", ...);`, so it prints the text
   * (or the char array's text) as-is and ends the line.
   */
  function parsePuts(): Stmt {
    const line = advance().line // puts
    expect('(')
    const token = peek()
    const isArrayName = token.kind === 'identifier' && (is(')', 1) || is(';', 1))
    if (token.kind !== 'string' && !isArrayName) throw new CodeError(token.line, 'codeError.putsText')
    const arg = parseText()
    expect(')')
    expect(';')
    return { kind: 'printf', line, format: '%s\n', args: [arg], isPuts: true }
  }

  /** `scanf("%d %f", &a, &b);` — one %d, %f or %s placeholder per variable, each read in turn. */
  function parseScanf(): Stmt {
    const line = advance().line // scanf
    expect('(')
    const formatToken = peek()
    if (formatToken.kind !== 'string') throw new CodeError(formatToken.line, 'codeError.scanfFormat')
    advance()

    const specifiers = readFormatSpecifiers(formatToken.text, line, 'scanf') as ('d' | 'f' | 's')[]
    if (specifiers.length === 0) throw new CodeError(line, 'codeError.scanfFormat')

    const targets: Target[] = []
    while (accept(',')) {
      const position = targets.length + 1
      // %s fills a whole char array, which is passed by its name alone: scanf("%s", name)
      if (specifiers[targets.length] === 's') {
        const token = peek()
        const name = is('&') ? peek(1).text : token.text
        if (token.kind !== 'identifier' || !(is(',', 1) || is(')', 1))) {
          throw scanfReadError(token.line, position, specifiers.length, 'codeError.scanfSTarget', { name })
        }
        targets.push({ kind: 'var', line: advance().line, name })
        continue
      }
      if (!accept('&')) {
        throw scanfReadError(peek().line, position, specifiers.length, 'codeError.scanfAmpersand', {
          name: peek().text,
        })
      }
      targets.push(parseTarget())
    }
    expect(')')
    expect(';')

    if (targets.length !== specifiers.length) {
      throw new CodeError(line, 'codeError.scanfCount', { placeholders: specifiers.length, given: targets.length })
    }
    const reads = targets.map((target, i) => ({ specifier: specifiers[i], target }))
    return { kind: 'scanf', line, reads }
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
        if (token.text === 'printf' || token.text === 'puts' || token.text === 'scanf') {
          throw new UnsupportedConstructError(
            token.line,
            { key: 'construct.printfInExpr', values: { name: token.text } },
            { key: 'unsupported.printfInExpr', values: { name: token.text } },
          )
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

    if (token.kind === 'char') {
      advance()
      return { kind: 'number', line: token.line, type: 'char', value: token.value ?? 0 }
    }
    if (token.kind === 'string') throw stringError(token.line)
    rejectUnsupportedKeyword(token)
    rejectUnsupportedOperator(token)
    throw new CodeError(token.line, 'codeError.expectedValue', { found: describe(token) })
  }
}

/** Returns the conversion letters in a printf or scanf format ("d", "f", "s", and "c" for printf), rejecting any others. */
function readFormatSpecifiers(format: string, line: number, fn: 'printf' | 'scanf' = 'printf'): string[] {
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
    const allowed = fn === 'printf' ? ['%d', '%f', '%c', '%s'] : ['%d', '%f', '%s']
    if (!allowed.includes(placeholder)) {
      throw new UnsupportedConstructError(
        line,
        { key: 'construct.placeholder', values: { placeholder, fn } },
        { key: fn === 'printf' ? 'unsupported.placeholder' : 'unsupported.scanfPlaceholder', values: { placeholder } },
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
