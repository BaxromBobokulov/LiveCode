import { CodeError, UnsupportedConstructError, type RunError } from './errors'
import { explain, type Shown, type StepFact } from './explain'
import {
  formatNumber,
  needsParens,
  parse,
  toSource,
  type BinaryOp,
  type Declarator,
  type Expr,
  type FunctionDecl,
  type NumType,
  type Program,
  type Stmt,
  type Target,
} from './parser'
import type { ArrayView, LoopInfo, Step } from './types'

/** Programs are stopped after this many steps, so a loop that never ends can't freeze the page. */
export const MAX_STEPS = 1000

/** Largest array the array view can reasonably show. */
const MAX_ARRAY_SIZE = 100

// Common C library functions, so calling one gives "not supported yet" rather than "doesn't exist".
const libraryFunctions = new Set([
  'scanf', 'puts', 'putchar', 'getchar', 'gets', 'fgets', 'fprintf', 'sprintf',
  'malloc', 'calloc', 'realloc', 'free', 'exit', 'abs', 'rand', 'srand', 'atoi',
  'strlen', 'strcpy', 'strcat', 'strcmp', 'memset', 'memcpy',
  'sqrt', 'pow', 'fabs', 'floor', 'ceil', 'sin', 'cos', 'tan', 'log', 'exp',
])

type Scalar = { kind: 'scalar'; type: NumType; value: number | null }
/** Arrays are shared by reference, so a function that receives one changes the caller's array. */
type ArrayStore = { kind: 'array'; type: NumType; values: number[] }
type Slot = Scalar | ArrayStore

/** One running function call. */
type Frame = {
  fn: FunctionDecl
  /** Variables by block, outermost first. Index 0 holds the parameters. */
  scopes: Map<string, Slot>[]
  /** Loops running in this call, innermost last. */
  loops: LoopRun[]
}

/** One run of a loop. Each iteration gets a LoopInfo; `total` is filled in once the loop ends. */
type LoopRun = { iteration: number; infos: LoopInfo[] }

/** A computed value, plus the expression with each value filled in ("4 + 8") for the explanation. */
type Value = { type: NumType; value: number; work: string }

/** What a `return` hands back up through the blocks and loops around it. null means `void`. */
type Returned = { value: number | null }

/** The result of running a statement whose step is described as part of something else (a loop header). */
type Effect = { facts: StepFact[]; changed: string[] }

/**
 * Runs the user's C code and returns one Step per meaningful statement, or the
 * error that stopped it. Never throws.
 */
export function runUserCode(source: string): { steps: Step[] } | { error: RunError } {
  try {
    return { steps: execute(parse(source)) }
  } catch (error) {
    if (error instanceof UnsupportedConstructError || error instanceof CodeError) return { error }
    return { error: new CodeError(1, 'Something went wrong while running this code.') }
  }
}

function convert(value: number, type: NumType): number {
  return type === 'int' ? Math.trunc(value) | 0 : Math.fround(value)
}

function formatSlot(slot: Slot): string {
  if (slot.kind === 'array') return `[${slot.values.map((v) => formatNumber(v, slot.type)).join(', ')}]`
  return slot.value === null ? '?' : formatNumber(slot.value, slot.type)
}

/** Wraps an operand's text in parentheses when the source would need them, e.g. "(4 + 8) * 2". */
function wrap(text: string, child: Expr, op: BinaryOp, isRight: boolean): string {
  return needsParens(child, op, isRight) ? `(${text})` : text
}

function arithmetic(op: BinaryOp, a: number, b: number, type: NumType, line: number): number {
  switch (op) {
    case '==': return a === b ? 1 : 0
    case '!=': return a !== b ? 1 : 0
    case '<': return a < b ? 1 : 0
    case '>': return a > b ? 1 : 0
    case '<=': return a <= b ? 1 : 0
    case '>=': return a >= b ? 1 : 0
    case '&&': return a !== 0 && b !== 0 ? 1 : 0
    case '||': return a !== 0 || b !== 0 ? 1 : 0
    case '+': return convert(a + b, type)
    case '-': return convert(a - b, type)
    case '*': return type === 'int' ? Math.imul(a, b) : Math.fround(a * b)
    case '/':
      if (b === 0) throw new CodeError(line, 'Division by zero. A number cannot be divided by 0.')
      return convert(a / b, type) // int division drops the fraction, like C
    case '%':
      if (type === 'float') throw new CodeError(line, 'The % operator only works with int values.')
      if (b === 0) throw new CodeError(line, 'Division by zero. % by 0 is not allowed.')
      return a % b
  }
}

/** Runs a parsed program from main() and records its steps. */
export function execute(program: Program): Step[] {
  const steps: Step[] = []
  const frames: Frame[] = []
  let output = ''
  /** The array element the current statement read or wrote. It is shown as active in the array view. */
  let access: { name: string; store: ArrayStore; index: number } | null = null

  const frame = () => frames[frames.length - 1]
  const callerName = () => (frames.length > 1 ? frames[frames.length - 2].fn.name : null)

  runFunction(program.functions.get('main')!, new Map(), null)
  return steps

  // ----- Recording steps -----

  function emit(line: number, fact: StepFact, changed: string[] = []) {
    if (steps.length >= MAX_STEPS) {
      throw new CodeError(line, `The program was stopped after ${MAX_STEPS} steps. Check for a loop that never ends.`)
    }
    const current = frame()

    // Inner blocks come last, so a shadowing variable replaces the outer one's value.
    const variables = new Map<string, string>()
    let firstArray: ArrayView | null = null
    for (const scope of current.scopes) {
      for (const [name, slot] of scope) {
        variables.set(name, formatSlot(slot))
        if (slot.kind === 'array' && !firstArray) firstArray = { name, values: [...slot.values], activeIndex: null }
      }
    }

    const loopRun = current.loops[current.loops.length - 1]
    steps.push({
      line,
      scope: `${current.fn.name}()`,
      variables: [...variables].map(([name, value]) => ({ name, value })),
      changed,
      array: access ? { name: access.name, values: [...access.store.values], activeIndex: access.index } : firstArray,
      loop: loopRun?.infos.at(-1) ?? null,
      output,
      explanation: explain(fact),
    })
    access = null
  }

  // ----- Functions -----

  /** Runs a function body. `callFact` is null for main, which starts without a "call" step. */
  function runFunction(fn: FunctionDecl, params: Map<string, Slot>, callFact: StepFact | null): number | null {
    frames.push({ fn, scopes: [params], loops: [] })
    if (callFact) emit(fn.line, callFact, fn.params.map((p) => p.name))

    const returned = runStatements(fn.body)
    if (!returned) {
      const caller = callerName()
      if (fn.returnType !== 'void' && caller !== null) {
        throw new CodeError(fn.endLine, `${fn.name} reaches its end without returning a value. Add a return statement.`)
      }
      emit(fn.endLine, { kind: 'end', name: fn.name, caller })
    }

    frames.pop()
    return returned ? returned.value : null
  }

  /** Calls a function from an expression. Returns null for a void function. */
  function evaluateCall(expr: Extract<Expr, { kind: 'call' }>): Value | null {
    const fn = program.functions.get(expr.name)
    if (!fn) {
      if (libraryFunctions.has(expr.name)) {
        throw new UnsupportedConstructError(
          expr.line,
          `${expr.name}()`,
          `${expr.name}() is not supported yet. The only library function available is printf.`,
        )
      }
      throw new CodeError(expr.line, `There is no function named ${expr.name}.`)
    }
    if (frames.some((f) => f.fn === fn)) {
      throw new UnsupportedConstructError(
        expr.line,
        'recursion',
        `${fn.name} is called again while it is still running (recursion). Recursion is not supported yet. Use a loop instead.`,
      )
    }
    if (expr.args.length !== fn.params.length) {
      throw new CodeError(expr.line, `${fn.name} takes ${fn.params.length} argument(s), but ${expr.args.length} were given.`)
    }

    const params = new Map<string, Slot>()
    const args: string[] = []
    const shownParams: { name: string; value: string; isArray: boolean }[] = []

    fn.params.forEach((param, i) => {
      const arg = expr.args[i]
      if (param.isArray) {
        const slot = arg.kind === 'var' ? lookup(arg.name, arg.line) : null
        if (!slot || slot.kind !== 'array' || arg.kind !== 'var') {
          throw new CodeError(expr.line, `${fn.name} expects an array for ${param.name}. Pass the array's name, e.g. ${fn.name}(arr, ...).`)
        }
        if (slot.type !== param.type) {
          throw new CodeError(expr.line, `${param.name} is a ${param.type} array, but ${arg.name} is a ${slot.type} array.`)
        }
        params.set(param.name, slot)
        args.push(arg.name)
        shownParams.push({ name: param.name, value: arg.name, isArray: true })
      } else {
        const value = evaluate(arg)
        const converted = convert(value.value, param.type)
        params.set(param.name, { kind: 'scalar', type: param.type, value: converted })
        args.push(formatNumber(value.value, value.type))
        shownParams.push({ name: param.name, value: formatNumber(converted, param.type), isArray: false })
      }
    })

    // The callee's steps shouldn't show the caller's array access, and vice versa.
    const callerAccess = access
    access = null
    const result = runFunction(fn, params, { kind: 'call', name: fn.name, args, params: shownParams })
    access = callerAccess

    if (result === null || fn.returnType === 'void') return null
    return { type: fn.returnType, value: result, work: formatNumber(result, fn.returnType) }
  }

  // ----- Variables -----

  function lookup(name: string, line: number): Slot {
    const { scopes } = frame()
    for (let i = scopes.length - 1; i >= 0; i--) {
      const slot = scopes[i].get(name)
      if (slot) return slot
    }
    if (program.functions.has(name)) throw new CodeError(line, `${name} is a function. Call it with ${name}(...).`)
    throw new CodeError(line, `${name} is not declared. Declare it first, e.g. int ${name} = 0;`)
  }

  function readScalar(name: string, line: number): Value {
    const slot = lookup(name, line)
    if (slot.kind === 'array') throw new CodeError(line, `${name} is an array. Use one element, e.g. ${name}[0].`)
    if (slot.value === null) throw new CodeError(line, `${name} is used before it has a value. Give it a value first.`)
    return { type: slot.type, value: slot.value, work: formatNumber(slot.value, slot.type) }
  }

  /** Finds the array element `arr[i]` refers to, and marks it as this step's active element. */
  function elementOf(expr: Extract<Expr, { kind: 'index' }>): { store: ArrayStore; index: number } {
    const store = lookup(expr.name, expr.line)
    if (store.kind !== 'array') throw new CodeError(expr.line, `${expr.name} is not an array, so ${expr.name}[...] can't be used.`)
    const index = evaluate(expr.index)
    if (index.type !== 'int') {
      throw new CodeError(expr.line, `An array index must be an int, but ${toSource(expr.index)} is a float.`)
    }
    const size = store.values.length
    if (index.value < 0 || index.value >= size) {
      throw new CodeError(
        expr.line,
        `${expr.name}[${index.value}] is outside the array. ${expr.name} has ${size} elements, so valid indexes are 0 to ${size - 1}.`,
      )
    }
    access = { name: expr.name, store, index: index.value }
    return { store, index: index.value }
  }

  /** Something that can be read and written: a variable or an array element. */
  function resolveTarget(target: Target) {
    if (target.kind === 'var') {
      const slot = lookup(target.name, target.line)
      if (slot.kind === 'array') {
        throw new CodeError(target.line, `${target.name} is an array. Assign to one element instead, e.g. ${target.name}[0] = 1;`)
      }
      return {
        label: target.name,
        type: slot.type,
        read: () => readScalar(target.name, target.line),
        write: (value: number) => (slot.value = convert(value, slot.type)),
      }
    }
    const { store, index } = elementOf(target)
    return {
      label: `${target.name}[${index}]`,
      type: store.type,
      read: (): Value => ({ type: store.type, value: store.values[index], work: formatNumber(store.values[index], store.type) }),
      write: (value: number) => (store.values[index] = convert(value, store.type)),
    }
  }

  function declare(type: NumType, d: Declarator): Effect {
    const scope = frame().scopes[frame().scopes.length - 1]
    if (scope.has(d.name)) throw new CodeError(d.line, `${d.name} is already declared here.`)

    if (d.isArray) {
      let size = d.arrayInit?.length ?? 0
      if (d.size) {
        const value = evaluate(d.size)
        if (value.type !== 'int' || value.value <= 0) {
          throw new CodeError(d.line, `The size of ${d.name} must be a whole number above 0.`)
        }
        size = value.value
      }
      if (size > MAX_ARRAY_SIZE) {
        throw new CodeError(d.line, `${d.name} is too big to show. Arrays can have at most ${MAX_ARRAY_SIZE} elements.`)
      }
      const init = d.arrayInit ?? []
      if (init.length > size) throw new CodeError(d.line, `${d.name} has room for ${size} values, but ${init.length} were given.`)

      // C fills the rest of a partly-initialised array with 0.
      const values = new Array<number>(size).fill(0)
      init.forEach((expr, i) => (values[i] = convert(evaluate(expr).value, type)))
      scope.set(d.name, { kind: 'array', type, values })
      const shown = d.arrayInit ? values.map((v) => formatNumber(v, type)) : null
      return { facts: [{ kind: 'declareArray', name: d.name, type, size, values: shown }], changed: [d.name] }
    }

    const value = d.init ? evaluate(d.init) : null
    const stored = value ? convert(value.value, type) : null
    scope.set(d.name, { kind: 'scalar', type, value: stored })
    const shown: Shown | null =
      d.init && value && stored !== null
        ? { source: toSource(d.init), work: value.work, result: formatNumber(stored, type) }
        : null
    return { facts: [{ kind: 'declare', name: d.name, value: shown }], changed: [d.name] }
  }

  // ----- Expressions -----

  function evaluate(expr: Expr): Value {
    switch (expr.kind) {
      case 'number':
        return { type: expr.type, value: convert(expr.value, expr.type), work: toSource(expr) }

      case 'var':
        return readScalar(expr.name, expr.line)

      case 'index': {
        const { store, index } = elementOf(expr)
        return { type: store.type, value: store.values[index], work: formatNumber(store.values[index], store.type) }
      }

      case 'unary': {
        const operand = evaluate(expr.operand)
        const work = expr.operand.kind === 'binary' ? `${expr.op}(${operand.work})` : `${expr.op}${operand.work}`
        if (expr.op === '!') return { type: 'int', value: operand.value === 0 ? 1 : 0, work }
        return { type: operand.type, value: convert(-operand.value, operand.type), work }
      }

      case 'binary': {
        const left = evaluate(expr.left)
        const leftWork = wrap(left.work, expr.left, expr.op, false)

        // && and || stop early when the left side already decides the answer, just like C.
        if ((expr.op === '&&' && left.value === 0) || (expr.op === '||' && left.value !== 0)) {
          const rightSource = wrap(toSource(expr.right), expr.right, expr.op, true)
          return { type: 'int', value: expr.op === '&&' ? 0 : 1, work: `${leftWork} ${expr.op} ${rightSource}` }
        }

        const right = evaluate(expr.right)
        const isComparison = !['+', '-', '*', '/', '%'].includes(expr.op)
        const type: NumType = isComparison ? 'int' : left.type === 'float' || right.type === 'float' ? 'float' : 'int'
        const operandType: NumType = left.type === 'float' || right.type === 'float' ? 'float' : 'int'
        return {
          type,
          value: arithmetic(expr.op, left.value, right.value, operandType, expr.line),
          work: `${leftWork} ${expr.op} ${wrap(right.work, expr.right, expr.op, true)}`,
        }
      }

      case 'call': {
        const result = evaluateCall(expr)
        if (!result) {
          throw new CodeError(expr.line, `${expr.name} is void, so it doesn't give back a value that can be used here.`)
        }
        return result
      }
    }
  }

  // ----- Statements -----

  /** Runs an assignment, increment or expression without recording a step, and describes what it did. */
  function runSimple(stmt: Extract<Stmt, { kind: 'assign' | 'update' | 'expr' }>): Effect {
    if (stmt.kind === 'expr') {
      const value = evaluate(stmt.expr)
      return {
        facts: [{ kind: 'expr', value: { source: toSource(stmt.expr), work: value.work, result: formatNumber(value.value, value.type) } }],
        changed: [],
      }
    }

    const target = resolveTarget(stmt.target)
    const name = stmt.target.name

    if (stmt.kind === 'update') {
      const current = target.read()
      const stored = target.write(arithmetic(stmt.op === '++' ? '+' : '-', current.value, 1, current.type, stmt.line))
      return {
        facts: [{ kind: 'update', target: target.label, op: stmt.op, result: formatNumber(stored, target.type) }],
        changed: [name],
      }
    }

    if (stmt.op === '=') {
      const value = evaluate(stmt.value)
      const stored = target.write(value.value)
      const shown = { source: toSource(stmt.value), work: value.work, result: formatNumber(stored, target.type) }
      return { facts: [{ kind: 'assign', target: target.label, value: shown }], changed: [name] }
    }

    // x += 5 is explained as x = x + 5.
    const op = stmt.op[0] as BinaryOp
    const current = target.read()
    const value = evaluate(stmt.value)
    const type: NumType = current.type === 'float' || value.type === 'float' ? 'float' : 'int'
    const stored = target.write(arithmetic(op, current.value, value.value, type, stmt.line))
    const shown = {
      source: `${toSource(stmt.target)} ${op} ${wrap(toSource(stmt.value), stmt.value, op, true)}`,
      work: `${current.work} ${op} ${wrap(value.work, stmt.value, op, true)}`,
      result: formatNumber(stored, target.type),
    }
    return { facts: [{ kind: 'assign', target: target.label, value: shown }], changed: [name] }
  }

  /** Runs a for loop's init or update part. Its step is merged into the loop check. */
  function runLoopPart(stmt: Stmt | null): Effect {
    if (!stmt) return { facts: [], changed: [] }
    if (stmt.kind === 'declare') {
      const effects = stmt.declarators.map((d) => declare(stmt.type, d))
      return { facts: effects.flatMap((e) => e.facts), changed: effects.flatMap((e) => e.changed) }
    }
    if (stmt.kind === 'assign' || stmt.kind === 'update' || stmt.kind === 'expr') return runSimple(stmt)
    throw new CodeError(stmt.line, 'This kind of statement cannot go inside a for (...) header.')
  }

  function runStatements(body: Stmt[]): Returned | null {
    for (const stmt of body) {
      const returned = run(stmt)
      if (returned) return returned
    }
    return null
  }

  function run(stmt: Stmt): Returned | null {
    switch (stmt.kind) {
      case 'declare':
        for (const d of stmt.declarators) {
          const { facts, changed } = declare(stmt.type, d)
          emit(d.line, facts[0], changed)
        }
        return null

      case 'expr':
        // A call on its own line, like `greet();`, is shown through its call and return steps.
        if (stmt.expr.kind === 'call') {
          evaluateCall(stmt.expr)
          return null
        }
        emit(stmt.line, runSimple(stmt).facts[0])
        return null

      case 'assign':
      case 'update': {
        const { facts, changed } = runSimple(stmt)
        emit(stmt.line, facts[0], changed)
        return null
      }

      case 'printf': {
        let argIndex = 0
        const text = stmt.format.replace(/%[dfs%]/g, (placeholder) => {
          if (placeholder === '%%') return '%'
          const arg = stmt.args[argIndex++]
          if (arg.kind === 'text') return arg.value
          const value = evaluate(arg)
          if (placeholder === '%d' && value.type !== 'int') {
            throw new CodeError(stmt.line, `%d prints an int, but ${toSource(arg)} is a float. Use %f instead.`)
          }
          if (placeholder === '%f' && value.type !== 'float') {
            throw new CodeError(stmt.line, `%f prints a float, but ${toSource(arg)} is an int. Use %d instead.`)
          }
          return placeholder === '%d' ? String(value.value) : value.value.toFixed(6)
        })
        output += text
        emit(stmt.line, { kind: 'print', text })
        return null
      }

      case 'block': {
        frame().scopes.push(new Map())
        const returned = runStatements(stmt.body)
        frame().scopes.pop()
        return returned
      }

      case 'if': {
        let node: Extract<Stmt, { kind: 'if' }> = stmt
        let branch: 'if' | 'else if' = 'if'
        for (;;) {
          const value = evaluate(node.cond)
          const result = value.value !== 0
          const next = node.otherwise === null ? 'nothing' : node.otherwise.kind === 'if' ? 'else if' : 'else'
          const condition = { source: toSource(node.cond), work: value.work, result: String(result) }
          emit(node.line, { kind: 'ifCheck', branch, condition, result, next })

          if (result) return run(node.then)
          if (node.otherwise === null) return null
          if (node.otherwise.kind !== 'if') return run(node.otherwise)
          node = node.otherwise
          branch = 'else if'
        }
      }

      case 'while':
      case 'for':
        return runLoop(stmt)

      case 'return': {
        const fn = frame().fn
        if (stmt.value && fn.returnType === 'void') throw new CodeError(stmt.line, `${fn.name} is void, so it can't return a value.`)
        if (!stmt.value && fn.returnType !== 'void') throw new CodeError(stmt.line, `${fn.name} must return a ${fn.returnType} value.`)

        if (!stmt.value || fn.returnType === 'void') {
          emit(stmt.line, { kind: 'return', name: fn.name, value: null, caller: callerName() })
          return { value: null }
        }
        const value = evaluate(stmt.value)
        const result = convert(value.value, fn.returnType)
        const shown = { source: toSource(stmt.value), work: value.work, result: formatNumber(result, fn.returnType) }
        emit(stmt.line, { kind: 'return', name: fn.name, value: shown, caller: callerName() })
        return { value: result }
      }
    }
  }

  function runLoop(stmt: Extract<Stmt, { kind: 'while' | 'for' }>): Returned | null {
    const current = frame()
    current.scopes.push(new Map()) // holds `i` from `for (int i = 0; ...)`
    const loop: LoopRun = { iteration: 0, infos: [] }
    current.loops.push(loop)

    let setup = stmt.kind === 'for' ? runLoopPart(stmt.init) : runLoopPart(null)
    let isFirst = true
    let returned: Returned | null = null

    for (;;) {
      let condition: Shown | null = null
      let result = true // `for (;;)` has no condition and keeps going
      if (stmt.cond) {
        const value = evaluate(stmt.cond)
        result = value.value !== 0
        condition = { source: toSource(stmt.cond), work: value.work, result: String(result) }
      }

      if (result) {
        loop.iteration++
        loop.infos.push({ line: stmt.line, iteration: loop.iteration, total: 0 })
      } else {
        current.loops.pop() // the final check belongs to the enclosing loop, if any
      }
      emit(stmt.line, { kind: 'loopCheck', setup: setup.facts, isFirst, condition, result }, setup.changed)
      isFirst = false
      if (!result) break

      returned = run(stmt.body)
      if (returned) {
        current.loops.pop()
        break
      }
      setup = stmt.kind === 'for' ? runLoopPart(stmt.update) : runLoopPart(null)
    }

    for (const info of loop.infos) info.total = loop.iteration
    current.scopes.pop()
    return returned
  }
}
