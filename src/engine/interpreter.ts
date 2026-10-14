import type { TranslationKey } from '../i18n/translations'
import { CodeError, UnsupportedConstructError, code, scanfReadError, type RunError } from './errors'
import { explain, type PointsTo, type Shown, type StepFact } from './explain'
import {
  formatNumber,
  needsParens,
  parse,
  pointerError,
  quoteText,
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
import { variableKey, type ArrayView, type GridCell, type GridView, type LoopInfo, type Phrase, type Step, type Variable } from './types'

/** Programs are stopped after this many steps, so a loop that never ends can't freeze the page. */
export const MAX_STEPS = 1000

/** The largest number rand() gives, as in most C compilers' <stdlib.h>. */
export const RAND_MAX = 32767

/**
 * Variables get made-up, small addresses instead of real memory addresses: the first one declared
 * is 0x100 and each next one is 4 higher (0x104, 0x108, ...), whatever its type. Addresses are never
 * reused within a Run, so a variable created again in a later loop iteration or call gets a new one.
 */
export const FIRST_ADDRESS = 0x100
const ADDRESS_STEP = 4

/** An address as the Variables panel and the explanations show it, e.g. "0x104". */
export function formatAddress(address: number): string {
  return `0x${address.toString(16)}`
}

/** Largest array (in total cells, for a 2D array) the array view can reasonably show. */
const MAX_ARRAY_SIZE = 100

// Common C library functions, so calling one gives "not supported yet" rather than "doesn't exist".
const libraryFunctions = new Set([
  'putchar', 'getchar', 'gets', 'fgets', 'fprintf', 'sprintf',
  'malloc', 'calloc', 'realloc', 'free', 'exit', 'abs', 'atoi',
  'strlen', 'strcpy', 'strcat', 'strcmp', 'memset', 'memcpy',
  'sqrt', 'pow', 'fabs', 'floor', 'ceil', 'sin', 'cos', 'tan', 'log', 'exp',
])

/** `ended` is set once the block that declared the variable is over, so a pointer to it can't be followed. */
type Scalar = { kind: 'scalar'; type: NumType; value: number | null; address: number; ended?: true }
/** The variable a pointer points to: the slot itself (it may live in another call), plus its name. */
type PointerTarget = { name: string; slot: Scalar }
/** `int *p`: points to an int variable (`type` is the pointee's type), or 'NULL', or null before it gets an address. */
type PointerStore = { kind: 'pointer'; type: NumType; target: PointerTarget | 'NULL' | null; address: number; ended?: true }
/** Arrays are shared by reference, so a function that receives one changes the caller's array. */
type ArrayStore = { kind: 'array'; type: NumType; values: number[] }
/** A 2D array: one inner array per row. Shared by reference, like ArrayStore. */
type GridStore = { kind: 'grid'; type: NumType; values: number[][] }
type Slot = Scalar | PointerStore | ArrayStore | GridStore

/** One running function call. */
type Frame = {
  fn: FunctionDecl
  /** Variables by block, outermost first. Index 0 holds the parameters. */
  scopes: Map<string, Slot>[]
  /** Loops running in this call, innermost last. */
  loops: LoopRun[]
}

/**
 * One run of a loop. Each iteration gets a LoopInfo; `total` is filled in once the loop ends, so after
 * a `break` it counts the iterations that actually ran (the one that broke out included).
 * `hasUpdate` marks a for loop with an update part (`i++`), which a `continue` runs before the next check.
 */
type LoopRun = { iteration: number; infos: LoopInfo[]; hasUpdate: boolean }

/** A computed value, plus the expression with each value filled in ("4 + 8") for the explanation. */
type Value = { type: NumType; value: number; work: string }

/**
 * How a statement can cut the rest of its block short, passed up through the blocks around it:
 * a `return` (its value, null for `void`) up to the function, a `break` or `continue` up to the innermost loop.
 */
type Jump = { kind: 'return'; value: number | null } | { kind: 'break' } | { kind: 'continue' }

/** The result of running a statement whose step is described as part of something else (a loop header). */
type Effect = { facts: StepFact[]; changed: string[] }

/** Whether the code calls scanf, so the Playground knows to show the Input field. */
export function usesScanf(source: string): boolean {
  return /\bscanf\s*\(/.test(source)
}

/**
 * Runs the user's C code and returns one Step per meaningful statement, or the
 * error that stopped it. Never throws. `input` is the Input field's text: the
 * values scanf reads, separated by spaces, in the order the program asks for them.
 */
export function runUserCode(source: string, input = ''): { steps: Step[] } | { error: RunError } {
  try {
    return { steps: execute(parse(source), input.split(/\s+/).filter((value) => value !== '')) }
  } catch (error) {
    if (error instanceof UnsupportedConstructError || error instanceof CodeError) return { error }
    return { error: new CodeError(1, 'codeError.internal') }
  }
}

function convert(value: number, type: NumType): number {
  if (type === 'float') return Math.fround(value)
  // A char holds -128 to 127, so a bigger number wraps around, like in C.
  return type === 'char' ? (Math.trunc(value) << 24) >> 24 : Math.trunc(value) | 0
}

/** The text in a char array: its characters up to the first \0, or null when there is no \0. */
function textOf(values: number[]): string | null {
  const end = values.indexOf(0)
  return end === -1 ? null : String.fromCharCode(...values.slice(0, end))
}

function formatSlot(slot: Slot): string {
  // A char array is shown as the text it holds, e.g. "hello".
  const formatRow = (row: number[]) =>
    slot.type === 'char'
      ? quoteText(textOf(row) ?? String.fromCharCode(...row))
      : `[${row.map((v) => formatNumber(v, slot.type)).join(', ')}]`
  if (slot.kind === 'array') return formatRow(slot.values)
  if (slot.kind === 'grid') return `[${slot.values.map(formatRow).join(', ')}]`
  // A pointer holds the address of the variable it points to.
  if (slot.kind === 'pointer') return slot.target === null ? '?' : showPointer(slot.target)
  return slot.value === null ? '?' : formatNumber(slot.value, slot.type)
}

/** A pointer's value as shown: the pointee's address, or NULL. */
function showPointer(target: PointerTarget | 'NULL'): string {
  return target === 'NULL' ? 'NULL' : formatAddress(target.slot.address)
}

/** How an explanation names what a pointer points to. */
function pointsTo(target: PointerTarget | 'NULL'): PointsTo {
  return target === 'NULL' ? 'NULL' : { target: target.name, address: formatAddress(target.slot.address) }
}

/** Marks the variables of a block (or a call) that just ended, so pointers to them can't be followed any more. */
function endScope(scope: Map<string, Slot>) {
  for (const slot of scope.values()) if (slot.kind === 'scalar' || slot.kind === 'pointer') slot.ended = true
}

/** What the array view shows for an array, with `active` as the element or cell in use. */
function arrayView(name: string, store: ArrayStore | GridStore, active: number | GridCell | null): ArrayView | GridView {
  const chars = store.type === 'char' ? { chars: true as const } : {}
  if (store.kind === 'grid') {
    return { name, values: store.values.map((row) => [...row]), activeIndex: typeof active === 'object' ? active : null, ...chars }
  }
  return { name, values: [...store.values], activeIndex: typeof active === 'number' ? active : null, ...chars }
}

/** The character codes of `text`, checking each one fits in a char (plain ASCII). */
function charCodes(text: string, line: number): number[] {
  return [...text].map((char) => {
    const code = char.charCodeAt(0)
    if (char.length > 1 || code > 127) throw new CodeError(line, 'codeError.nonAsciiChar', { char })
    return code
  })
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
    case '*': return type === 'float' ? Math.fround(a * b) : convert(Math.imul(a, b), type)
    case '/':
      if (b === 0) throw new CodeError(line, 'codeError.divisionByZero')
      return convert(a / b, type) // int division drops the fraction, like C
    case '%':
      if (type === 'float') throw new CodeError(line, 'codeError.modFloat')
      if (b === 0) throw new CodeError(line, 'codeError.modByZero')
      return a % b
  }
}

/** Runs a parsed program from main() and records its steps. `input` holds the values for scanf, in order. */
export function execute(program: Program, input: string[] = []): Step[] {
  const steps: Step[] = []
  const frames: Frame[] = []
  let output = ''
  /** How many input values scanf has used so far. */
  let inputUsed = 0
  /**
   * rand()'s state. Every rand() (and time(NULL)) is worked out right here, while the whole trace is built
   * in one go, so its number is fixed in the steps: Previous / Next / Auto Play replay it and never pick a
   * new one. Without srand() the seed is 1, as in real C, so every Run gives the same numbers.
   */
  let randomState = 1
  /** The made-up address the next declared variable gets (see FIRST_ADDRESS). */
  let nextAddress = FIRST_ADDRESS
  /**
   * The array the current statement used, and the element or 2D cell it read or wrote (shown as active
   * in the array view). `active` is null when it used the whole array, e.g. printf("%s", name).
   */
  let access: { name: string; store: ArrayStore | GridStore; active: number | GridCell | null } | null = null
  /** 2D cells the current statement read and rand() numbers it got, explained before what the statement did. */
  let cellReads: StepFact[] = []
  /**
   * A loop check whose body runs next, with the arrays as they were at the check. If the body's
   * first step uses an array element, the check highlights it too, one step early, the same way
   * the hand-authored examples do.
   */
  let pendingCheck: { step: Step; frame: Frame; arrays: Map<string, ArrayStore | GridStore> } | null = null

  const frame = () => frames[frames.length - 1]
  const callerName = () => (frames.length > 1 ? frames[frames.length - 2].fn.name : null)

  runFunction(program.functions.get('main')!, new Map(), null)
  return steps

  // ----- Recording steps -----

  function emit(line: number, fact: StepFact, changed: string[] = []) {
    if (steps.length >= MAX_STEPS) {
      throw new CodeError(line, 'codeError.stepLimit', { max: MAX_STEPS })
    }
    const current = frame()

    // Inner blocks come last, so a shadowing variable replaces the outer one's value.
    const variables = new Map<string, Variable>()
    const shownSlots = new Map<string, Slot>()
    let firstArray: ArrayView | GridView | null = null
    for (const scope of current.scopes) {
      for (const [name, slot] of scope) {
        variables.set(name, showVariable(name, slot))
        shownSlots.set(name, slot)
        if ((slot.kind === 'array' || slot.kind === 'grid') && !firstArray) firstArray = arrayView(name, slot, null)
      }
    }
    // A pointer here may point to a variable of a caller, e.g. swap(&x, &y): show that variable too,
    // as "x · main()", so the arrow has a box to point at. It goes away when this call returns.
    const visible = new Set(shownSlots.values())
    for (const slot of shownSlots.values()) {
      if (slot.kind !== 'pointer' || slot.target === null || slot.target === 'NULL') continue
      const { name, slot: target } = slot.target
      const owner = target.ended || visible.has(target) ? undefined : ownerOf(target)
      if (!owner) continue
      visible.add(target)
      const variable = { ...showVariable(name, target), scope: `${owner.fn.name}()` }
      variables.set(variableKey(variable), variable)
    }

    if (pendingCheck) {
      const before = access && pendingCheck.frame === current ? pendingCheck.arrays.get(access.name) : undefined
      if (access && before) pendingCheck.step.array = arrayView(access.name, before, access.active)
      pendingCheck = null
    }

    const loopRun = current.loops[current.loops.length - 1]
    steps.push({
      line,
      scope: `${current.fn.name}()`,
      variables: [...variables.values()],
      changed,
      array: access ? arrayView(access.name, access.store, access.active) : firstArray,
      loop: loopRun?.infos.at(-1) ?? null,
      output,
      explanation: [...cellReads, fact].flatMap(explain),
    })
    access = null
    cellReads = []
  }

  /**
   * One variable for the Variables panel. In a program with pointers, each plain variable and pointer
   * also shows its address, and a pointer names the address it points to so the panel can draw an arrow.
   */
  function showVariable(name: string, slot: Slot): Variable {
    const variable: Variable = { name, value: formatSlot(slot) }
    if (!program.usesPointers || (slot.kind !== 'scalar' && slot.kind !== 'pointer')) return variable
    variable.address = formatAddress(slot.address)
    if (slot.kind !== 'pointer') return variable
    variable.isPointer = true
    if (slot.target !== null && slot.target !== 'NULL') variable.pointsTo = formatAddress(slot.target.slot.address)
    return variable
  }

  /** The running call that holds `slot`, if any. */
  function ownerOf(slot: Slot): Frame | undefined {
    return frames.find((f) => f.scopes.some((scope) => [...scope.values()].includes(slot)))
  }

  /**
   * How `changed` names the variable a pointer points to: its name when it belongs to the running
   * call, or "x@main()" for a caller's variable (shown as "x · main()", see emit).
   */
  function pointeeKey(target: PointerTarget): string {
    if (findSlot(target.name) === target.slot) return target.name
    const owner = ownerOf(target.slot)
    return owner && owner !== frame() ? variableKey({ name: target.name, scope: `${owner.fn.name}()` }) : target.name
  }

  function newAddress(): number {
    const address = nextAddress
    nextAddress += ADDRESS_STEP
    return address
  }

  /** Copies of the arrays visible right now, by name. Inner blocks win, as for variables. */
  function arraysInScope(): Map<string, ArrayStore | GridStore> {
    const arrays = new Map<string, ArrayStore | GridStore>()
    for (const scope of frame().scopes) {
      for (const [name, slot] of scope) {
        if (slot.kind === 'array') arrays.set(name, { ...slot, values: [...slot.values] })
        if (slot.kind === 'grid') arrays.set(name, { ...slot, values: slot.values.map((row) => [...row]) })
      }
    }
    return arrays
  }

  // ----- Functions -----

  /** Runs a function body. `callFact` is null for main, which starts without a "call" step. */
  function runFunction(fn: FunctionDecl, params: Map<string, Slot>, callFact: StepFact | null): number | null {
    frames.push({ fn, scopes: [params], loops: [] })
    if (callFact) emit(fn.line, callFact, fn.params.map((p) => p.name))

    // The parser only allows break and continue inside a loop, so only a return gets this far.
    const jump = runStatements(fn.body)
    const returned = jump?.kind === 'return' ? jump : null
    if (!returned) {
      const caller = callerName()
      if (fn.returnType !== 'void' && caller !== null) {
        throw new CodeError(fn.endLine, 'codeError.missingReturn', { name: fn.name })
      }
      emit(fn.endLine, { kind: 'end', name: fn.name, caller })
    }

    frames.pop()?.scopes.forEach(endScope)
    return returned ? returned.value : null
  }

  /** Calls a function from an expression. Returns null for a void function. */
  function evaluateCall(expr: Extract<Expr, { kind: 'call' }>): Value | null {
    const fn = program.functions.get(expr.name)
    if (!fn) {
      if (expr.name === 'rand' || expr.name === 'srand') return evaluateRandomCall(expr)
      if (expr.name === 'time') return evaluateTime(expr)
      if (libraryFunctions.has(expr.name)) {
        throw new UnsupportedConstructError(
          expr.line,
          code(`${expr.name}()`),
          { key: 'unsupported.libraryFunction', values: { name: expr.name } },
        )
      }
      throw new CodeError(expr.line, 'codeError.noFunction', { name: expr.name })
    }
    if (frames.some((f) => f.fn === fn)) {
      throw new UnsupportedConstructError(
        expr.line,
        { key: 'construct.recursion' },
        { key: 'unsupported.recursion', values: { name: fn.name } },
      )
    }
    if (expr.args.length !== fn.params.length) {
      throw new CodeError(expr.line, 'codeError.argCount', {
        name: fn.name,
        expected: fn.params.length,
        given: expr.args.length,
      })
    }

    const params = new Map<string, Slot>()
    const args: string[] = []
    const shownParams: Extract<StepFact, { kind: 'call' }>['params'] = []

    fn.params.forEach((param, i) => {
      const arg = expr.args[i]
      if (param.isPointer) {
        // The address is passed, not a copy: *a inside the function is the caller's variable.
        const target = pointerValue(arg, () => new CodeError(expr.line, 'codeError.expectsPointer', { fn: fn.name, param: param.name }))
        const slot: PointerStore = { kind: 'pointer', type: param.type, target: null, address: newAddress() }
        setPointer(param.name, slot, target, expr.line)
        params.set(param.name, slot)
        args.push(toSource(arg))
        shownParams.push({ name: param.name, value: showPointer(target), isArray: false, points: pointsTo(target) })
      } else if (param.isArray) {
        const slot = arg.kind === 'var' ? lookup(arg.name, arg.line) : null
        const isGridParam = param.columns !== null
        if (!slot || slot.kind !== (isGridParam ? 'grid' : 'array') || arg.kind !== 'var') {
          throw new CodeError(expr.line, isGridParam ? 'codeError.expectsGrid' : 'codeError.expectsArray', {
            fn: fn.name,
            param: param.name,
          })
        }
        if (slot.kind === 'grid' && slot.values[0].length !== param.columns) {
          throw new CodeError(expr.line, 'codeError.columnsMismatch', {
            param: param.name,
            expected: String(param.columns),
            arg: arg.name,
            actual: slot.values[0].length,
          })
        }
        if (slot.type !== param.type) {
          throw new CodeError(expr.line, 'codeError.arrayTypeMismatch', {
            param: param.name,
            paramType: param.type,
            arg: arg.name,
            argType: slot.type,
          })
        }
        params.set(param.name, slot)
        args.push(arg.name)
        shownParams.push({ name: param.name, value: arg.name, isArray: true })
      } else {
        const value = evaluate(arg)
        const converted = convert(value.value, param.type)
        params.set(param.name, { kind: 'scalar', type: param.type, value: converted, address: newAddress() })
        args.push(formatNumber(value.value, value.type))
        shownParams.push({ name: param.name, value: formatNumber(converted, param.type), isArray: false })
      }
    })

    // The callee's steps shouldn't show the caller's array access, and vice versa.
    const callerAccess = access
    const callerReads = cellReads
    access = null
    cellReads = []
    const result = runFunction(fn, params, { kind: 'call', name: fn.name, args, params: shownParams })
    access = callerAccess
    cellReads = callerReads

    if (result === null || fn.returnType === 'void') return null
    return { type: fn.returnType, value: result, work: formatNumber(result, fn.returnType) }
  }

  /**
   * `rand()` and `srand(seed)` from <stdlib.h>, using the sample rand() given in the C standard itself.
   * srand(seed) restarts the sequence, so the same seed always gives the same numbers.
   */
  function evaluateRandomCall(expr: Extract<Expr, { kind: 'call' }>): Value | null {
    const expected = expr.name === 'rand' ? 0 : 1
    if (expr.args.length !== expected) {
      throw new CodeError(expr.line, 'codeError.argCount', { name: expr.name, expected, given: expr.args.length })
    }

    if (expr.name === 'srand') {
      const seed = evaluate(expr.args[0])
      const value = convert(seed.value, 'int')
      randomState = value >>> 0
      const arg = expr.args[0]
      emit(expr.line, {
        kind: 'srand',
        seed: { source: toSource(arg), work: seed.work, result: formatNumber(value, 'int') },
        fromTime: arg.kind === 'call' && arg.name === 'time',
      })
      return null
    }

    randomState = (Math.imul(randomState, 1103515245) + 12345) >>> 0
    const value = (randomState >>> 16) % (RAND_MAX + 1)
    cellReads.push({ kind: 'rand', value: String(value) })
    return { type: 'int', value, work: String(value) }
  }

  /**
   * `time(NULL)` from <time.h>: the seconds since 1 January 1970, read once while the trace is built.
   * Only the NULL form is supported; `time(&t)` would need a pointer.
   */
  function evaluateTime(expr: Extract<Expr, { kind: 'call' }>): Value {
    if (expr.args.length !== 1) {
      throw new CodeError(expr.line, 'codeError.argCount', { name: 'time', expected: 1, given: expr.args.length })
    }
    const arg = expr.args[0]
    if (arg.kind !== 'null') {
      throw new UnsupportedConstructError(
        expr.line,
        code(`time(${toSource(arg)})`),
        { key: 'unsupported.timeArg', values: { arg: toSource(arg) } },
      )
    }
    const value = Math.floor(Date.now() / 1000) | 0
    cellReads.push({ kind: 'time', value: String(value) })
    return { type: 'int', value, work: String(value) }
  }

  // ----- Variables -----

  /** The variable `name` in the running call, innermost block first, or undefined. */
  function findSlot(name: string): Slot | undefined {
    const { scopes } = frame()
    for (let i = scopes.length - 1; i >= 0; i--) {
      const slot = scopes[i].get(name)
      if (slot) return slot
    }
    return undefined
  }

  function lookup(name: string, line: number): Slot {
    const slot = findSlot(name)
    if (slot) return slot
    if (program.functions.has(name)) throw new CodeError(line, 'codeError.isFunction', { name })
    throw new CodeError(line, 'codeError.notDeclared', { name })
  }

  function readScalar(name: string, line: number): Value {
    const slot = lookup(name, line)
    if (slot.kind === 'array') throw new CodeError(line, 'codeError.isArray', { name })
    if (slot.kind === 'grid') throw new CodeError(line, 'codeError.isGrid', { name })
    if (slot.kind === 'pointer') throw new CodeError(line, 'codeError.pointerAsNumber', { name, deref: `*${name}` })
    if (slot.value === null) throw new CodeError(line, 'codeError.noValue', { name })
    return { type: slot.type, value: slot.value, work: formatNumber(slot.value, slot.type) }
  }

  // ----- Pointers -----

  /**
   * `*p`: the variable the pointer p points to. Following a NULL pointer, one that was never given an
   * address, or one whose variable no longer exists is a mistake in the program.
   */
  function follow(name: string, line: number): PointerTarget {
    const slot = lookup(name, line)
    if (slot.kind !== 'pointer') throw new CodeError(line, 'codeError.derefNotPointer', { name, deref: `*${name}` })
    if (slot.target === null) throw new CodeError(line, 'codeError.derefUninit', { pointer: name, deref: `*${name}` })
    if (slot.target === 'NULL') throw new CodeError(line, 'codeError.derefNull', { pointer: name, deref: `*${name}` })
    if (slot.target.slot.ended) {
      throw new CodeError(line, 'codeError.derefDangling', { pointer: name, deref: `*${name}`, target: slot.target.name })
    }
    return slot.target
  }

  /**
   * What a pointer expression points to: `&x`, `NULL`, or another pointer's value (`q`).
   * Anything else (a number, `x + 1`, ...) is not an address, and `notAddress` says why.
   */
  function pointerValue(expr: Expr, notAddress: () => CodeError): PointerTarget | 'NULL' {
    if (expr.kind === 'null') return 'NULL'
    if (expr.kind === 'address') {
      const slot = lookup(expr.name, expr.line)
      if (slot.kind === 'pointer') throw pointerError(expr.line, 'unsupported.pointerToPointer')
      if (slot.kind !== 'scalar') throw pointerError(expr.line, 'unsupported.pointerToArray')
      return { name: expr.name, slot }
    }
    if (expr.kind === 'var') {
      const slot = lookup(expr.name, expr.line)
      if (slot.kind === 'pointer') {
        if (slot.target === null) throw new CodeError(expr.line, 'codeError.pointerNoValue', { name: expr.name })
        return slot.target
      }
    }
    throw notAddress()
  }

  /** Points the pointer `name` (of type `slot.type`) at `target`, checking the types match: an int * only points to an int. */
  function setPointer(name: string, slot: PointerStore, target: PointerTarget | 'NULL', line: number) {
    if (target !== 'NULL' && target.slot.type !== slot.type) {
      throw new CodeError(line, 'codeError.pointerTypeMismatch', {
        name,
        pointerType: slot.type,
        target: target.name,
        targetType: target.slot.type,
      })
    }
    slot.target = target
  }

  /** Whether `expr` is an address rather than a number: `&x`, `NULL`, or a pointer variable. */
  function isPointerExpr(expr: Expr): boolean {
    if (expr.kind === 'null' || expr.kind === 'address') return true
    return expr.kind === 'var' && findSlot(expr.name)?.kind === 'pointer'
  }

  /** `p == q`, `p != NULL`: two pointers are equal when they point to the same variable (or are both NULL). */
  function comparePointers(expr: Extract<Expr, { kind: 'binary' }>): Value {
    const notAddress = () => new CodeError(expr.line, 'codeError.pointerCompare', { source: toSource(expr) })
    const left = pointerValue(expr.left, notAddress)
    const right = pointerValue(expr.right, notAddress)
    const same = left === 'NULL' || right === 'NULL' ? left === right : left.slot === right.slot
    return {
      type: 'int',
      value: (expr.op === '==') === same ? 1 : 0,
      work: `${showPointer(left)} ${expr.op} ${showPointer(right)}`,
    }
  }

  /** `p = &x;`, `p = q;` or `p = NULL;`. Moving a pointer with `p++` or `p += 1` is pointer arithmetic. */
  function assignPointer(stmt: Extract<Stmt, { kind: 'assign' | 'update' }>, name: string, slot: PointerStore): Effect {
    if (stmt.kind === 'update' || stmt.op !== '=') throw pointerError(stmt.line, 'unsupported.pointerArithmetic')
    const value = stmt.value
    const target = pointerValue(value, () => new CodeError(stmt.line, 'codeError.notAddress', { name, value: toSource(value) }))
    setPointer(name, slot, target, stmt.line)
    return { facts: [{ kind: 'pointTo', name, points: pointsTo(target) }], changed: [name] }
  }

  /** Finds the array element `arr[i]` refers to, and marks it as this step's active element. */
  function elementOf(expr: Extract<Expr, { kind: 'index' }>): { store: ArrayStore; index: number } {
    const store = lookup(expr.name, expr.line)
    if (store.kind === 'grid') {
      throw new CodeError(expr.line, 'codeError.gridNeedsTwo', { name: expr.name })
    }
    if (store.kind !== 'array') throw new CodeError(expr.line, 'codeError.notArray', { name: expr.name })
    const size = store.values.length
    const index = evaluateIndex(expr.index, size, expr.line, (i) => ({
      key: 'codeError.indexOutside',
      values: { name: expr.name, index: i, size, last: size - 1 },
    }))
    access = { name: expr.name, store, active: index }
    return { store, index }
  }

  /** Finds the 2D array cell `grid[i][j]` refers to, and marks it as this step's active cell. */
  function cellOf(expr: Extract<Expr, { kind: 'cell' }>): { store: GridStore; row: number; col: number } {
    const store = lookup(expr.name, expr.line)
    if (store.kind === 'array') {
      throw new CodeError(expr.line, 'codeError.arrayNeedsOne', { name: expr.name })
    }
    if (store.kind !== 'grid') throw new CodeError(expr.line, 'codeError.notGrid', { name: expr.name })
    const rows = store.values.length
    const cols = store.values[0].length
    const row = evaluateIndex(expr.row, rows, expr.line, (r) => ({
      key: 'codeError.rowOutside',
      values: { name: expr.name, row: r, rows, last: rows - 1 },
    }))
    const col = evaluateIndex(expr.col, cols, expr.line, (c) => ({
      key: 'codeError.colOutside',
      values: { name: expr.name, row, col: c, cols, last: cols - 1 },
    }))
    access = { name: expr.name, store, active: { row, col } }
    return { store, row, col }
  }

  /** Works out an array index and checks it is an int from 0 to size - 1. */
  function evaluateIndex(
    index: Expr,
    size: number,
    line: number,
    outsideMessage: (value: number) => Required<Phrase>,
  ): number {
    const value = evaluate(index)
    if (value.type === 'float') throw new CodeError(line, 'codeError.indexFloat', { index: toSource(index) })
    if (value.value < 0 || value.value >= size) {
      const { key, values } = outsideMessage(value.value)
      throw new CodeError(line, key, values)
    }
    return value.value
  }

  /**
   * Something that can be read and written: a variable, an array element, or the variable a pointer
   * points to (`*p`). `changed` names the variable that is highlighted when it is written.
   */
  function resolveTarget(target: Target) {
    if (target.kind === 'var') {
      const slot = lookup(target.name, target.line)
      if (slot.kind === 'pointer') throw new CodeError(target.line, 'codeError.pointerAsNumber', { name: target.name, deref: `*${target.name}` })
      if (slot.kind !== 'scalar') {
        const example = slot.kind === 'grid' ? `${target.name}[0][0] = 1;` : `${target.name}[0] = 1;`
        throw new CodeError(target.line, 'codeError.assignArray', { name: target.name, example })
      }
      return {
        label: target.name,
        changed: target.name,
        type: slot.type,
        read: () => readScalar(target.name, target.line),
        write: (value: number) => (slot.value = convert(value, slot.type)),
      }
    }
    if (target.kind === 'deref') {
      const pointee = follow(target.name, target.line)
      const slot = pointee.slot
      cellReads.push({ kind: 'derefWrite', pointer: target.name, target: pointee.name })
      return {
        label: `*${target.name}`,
        changed: pointeeKey(pointee),
        type: slot.type,
        read: (): Value => {
          if (slot.value === null) throw new CodeError(target.line, 'codeError.noValue', { name: pointee.name })
          return { type: slot.type, value: slot.value, work: formatNumber(slot.value, slot.type) }
        },
        write: (value: number) => (slot.value = convert(value, slot.type)),
      }
    }
    if (target.kind === 'cell') {
      const { store, row, col } = cellOf(target)
      return {
        label: `${target.name}[${row}][${col}]`,
        changed: target.name,
        type: store.type,
        read: (): Value => ({ type: store.type, value: store.values[row][col], work: formatNumber(store.values[row][col], store.type) }),
        write: (value: number) => (store.values[row][col] = convert(value, store.type)),
      }
    }
    const { store, index } = elementOf(target)
    return {
      label: `${target.name}[${index}]`,
      changed: target.name,
      type: store.type,
      read: (): Value => ({ type: store.type, value: store.values[index], work: formatNumber(store.values[index], store.type) }),
      write: (value: number) => (store.values[index] = convert(value, store.type)),
    }
  }

  function declare(type: NumType, d: Declarator): Effect {
    const scope = frame().scopes[frame().scopes.length - 1]
    if (scope.has(d.name)) throw new CodeError(d.line, 'codeError.alreadyDeclared', { name: d.name })

    if (d.isPointer) return declarePointer(type, d, scope)

    if (d.isArray && d.columns) return declareGrid(type, d, d.columns, scope)

    if (d.isArray && d.stringInit !== null) return declareString(d, d.stringInit, scope)

    if (d.isArray) {
      const size = d.size ? evaluateSize(d.size, d) : (d.arrayInit?.length ?? 0)
      checkArraySize(size, d)
      const init = d.arrayInit ?? []
      if (init.length > size) {
        throw new CodeError(d.line, 'codeError.tooManyValues', { name: d.name, size, given: init.length })
      }

      // C fills the rest of a partly-initialised array with 0 (for a char array, that is \0).
      const values = new Array<number>(size).fill(0)
      init.forEach((expr, i) => (values[i] = convert(evaluate(expr).value, type)))
      scope.set(d.name, { kind: 'array', type, values })
      const shown = d.arrayInit ? values.map((v) => formatNumber(v, type)) : null
      return { facts: [{ kind: 'declareArray', name: d.name, type, size, values: shown }], changed: [d.name] }
    }

    const value = d.init ? evaluate(d.init) : null
    const stored = value ? convert(value.value, type) : null
    scope.set(d.name, { kind: 'scalar', type, value: stored, address: newAddress() })
    const shown: Shown | null =
      d.init && value && stored !== null
        ? { source: toSource(d.init), work: value.work, result: formatNumber(stored, type) }
        : null
    return { facts: [{ kind: 'declare', name: d.name, value: shown }], changed: [d.name] }
  }

  /** `int *p;`, `int *p = &x;` or `int *p = NULL;` */
  function declarePointer(type: NumType, d: Declarator, scope: Map<string, Slot>): Effect {
    const slot: PointerStore = { kind: 'pointer', type, target: null, address: newAddress() }
    const init = d.init
    if (init) {
      const target = pointerValue(init, () => new CodeError(d.line, 'codeError.notAddress', { name: d.name, value: toSource(init) }))
      setPointer(d.name, slot, target, d.line)
    }
    scope.set(d.name, slot)
    const points = slot.target === null ? null : pointsTo(slot.target)
    return { facts: [{ kind: 'declarePointer', name: d.name, points }], changed: [d.name] }
  }

  /**
   * `char name[] = "hello";` stores the characters and then a \0 that marks where the text ends,
   * so it needs one element more than the text has characters: here 6.
   */
  function declareString(d: Declarator, text: string, scope: Map<string, Slot>): Effect {
    const codes = charCodes(text, d.line)
    const size = d.size ? evaluateSize(d.size, d) : codes.length + 1
    checkArraySize(size, d)
    if (codes.length + 1 > size) {
      throw new CodeError(d.line, 'codeError.stringTooLong', {
        text: quoteText(text),
        needed: codes.length + 1,
        count: codes.length,
        name: d.name,
        size,
      })
    }
    const values = new Array<number>(size).fill(0)
    codes.forEach((c, i) => (values[i] = c))
    scope.set(d.name, { kind: 'array', type: 'char', values })
    return {
      facts: [{ kind: 'declareString', name: d.name, size, text: quoteText(text), count: codes.length }],
      changed: [d.name],
    }
  }

  function checkArraySize(size: number, d: Declarator) {
    if (size > MAX_ARRAY_SIZE) {
      throw new CodeError(d.line, 'codeError.arrayTooBig', { name: d.name, max: MAX_ARRAY_SIZE })
    }
  }

  /**
   * The text in the char array `name`, for printf's %s or puts. Marks the whole array as used,
   * so the array view shows it.
   */
  function readText(name: string, line: number, notText: () => CodeError): string {
    const slot = lookup(name, line)
    if (slot.kind !== 'array' || slot.type !== 'char') throw notText()
    const text = textOf(slot.values)
    if (text === null) throw new CodeError(line, 'codeError.noTerminator', { name })
    access = { name, store: slot, active: null }
    return text
  }

  /** `int grid[rows][cols] = {{...}, {...}};` */
  function declareGrid(type: NumType, d: Declarator, columns: Expr, scope: Map<string, Slot>): Effect {
    const cols = evaluateSize(columns, d)
    const init = d.gridInit ?? []
    const rows = d.size ? evaluateSize(d.size, d) : init.length
    if (rows * cols > MAX_ARRAY_SIZE) {
      throw new CodeError(d.line, 'codeError.gridTooBig', { name: d.name, max: MAX_ARRAY_SIZE })
    }
    if (init.length > rows) throw new CodeError(d.line, 'codeError.tooManyRows', { name: d.name, rows, given: init.length })
    init.forEach((row, r) => {
      if (row.length > cols) {
        throw new CodeError(d.line, 'codeError.rowTooManyValues', { row: r, name: d.name, cols, given: row.length })
      }
    })

    // Like 1D arrays, any cell without a value starts at 0.
    const values = Array.from({ length: rows }, () => new Array<number>(cols).fill(0))
    init.forEach((row, r) => row.forEach((expr, c) => (values[r][c] = convert(evaluate(expr).value, type))))
    scope.set(d.name, { kind: 'grid', type, values })
    const shown = d.gridInit ? values.map((row) => row.map((v) => formatNumber(v, type))) : null
    return { facts: [{ kind: 'declareGrid', name: d.name, type, rows, cols, values: shown }], changed: [d.name] }
  }

  /** An array size (or a 2D array's row or column count): a whole number above 0. */
  function evaluateSize(expr: Expr, d: Declarator): number {
    const value = evaluate(expr)
    if (value.type !== 'int' || value.value <= 0) {
      throw new CodeError(d.line, 'codeError.badSize', { name: d.name })
    }
    return value.value
  }

  // ----- Expressions -----

  function evaluate(expr: Expr): Value {
    switch (expr.kind) {
      case 'number':
        return { type: expr.type, value: convert(expr.value, expr.type), work: toSource(expr) }

      case 'var':
        return readScalar(expr.name, expr.line)

      case 'deref': {
        const pointee = follow(expr.name, expr.line)
        const { value, type } = pointee.slot
        if (value === null) throw new CodeError(expr.line, 'codeError.noValue', { name: pointee.name })
        const work = formatNumber(value, type)
        cellReads.push({ kind: 'derefRead', pointer: expr.name, target: pointee.name, value: work })
        return { type, value, work }
      }

      // An address or NULL only makes sense where a pointer is expected, e.g. `p = &x;` or `p == NULL`.
      case 'address':
        throw new CodeError(expr.line, 'codeError.addressAsNumber', { expr: toSource(expr) })
      case 'null':
        throw new CodeError(expr.line, 'codeError.nullAsNumber')

      case 'index': {
        const { store, index } = elementOf(expr)
        return { type: store.type, value: store.values[index], work: formatNumber(store.values[index], store.type) }
      }

      case 'cell': {
        const { store, row, col } = cellOf(expr)
        const work = formatNumber(store.values[row][col], store.type)
        cellReads.push({ kind: 'readCell', target: `${expr.name}[${row}][${col}]`, value: work })
        return { type: store.type, value: store.values[row][col], work }
      }

      case 'unary': {
        const operand = evaluate(expr.operand)
        const work = expr.operand.kind === 'binary' ? `${expr.op}(${operand.work})` : `${expr.op}${operand.work}`
        if (expr.op === '!') return { type: 'int', value: operand.value === 0 ? 1 : 0, work }
        // Like any arithmetic on a char, -c gives an int.
        const type: NumType = operand.type === 'float' ? 'float' : 'int'
        return { type, value: convert(-operand.value, type), work }
      }

      case 'binary': {
        if (isPointerExpr(expr.left) || isPointerExpr(expr.right)) {
          if (expr.op === '==' || expr.op === '!=') return comparePointers(expr)
          if (expr.op === '+' || expr.op === '-') throw pointerError(expr.line, 'unsupported.pointerArithmetic')
        }
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
          throw new CodeError(expr.line, 'codeError.voidValue', { name: expr.name })
        }
        return result
      }

      // The parser only lets a "string" through where text is expected, which never needs its value.
      case 'string':
        throw new UnsupportedConstructError(expr.line, { key: 'construct.string' }, { key: 'unsupported.string' })
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

    if (stmt.target.kind === 'var') {
      const slot = lookup(stmt.target.name, stmt.target.line)
      if (slot.kind === 'pointer') return assignPointer(stmt, stmt.target.name, slot)
    }

    const target = resolveTarget(stmt.target)
    const name = target.changed

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

  /**
   * Runs a for loop's init or update part, each comma-separated piece in turn, left to right.
   * There is no step of its own: everything it did is merged into the loop check's step.
   */
  function runLoopPart(parts: Stmt[]): Effect {
    const effects = parts.map((stmt): Effect => {
      if (stmt.kind === 'declare') {
        const declared = stmt.declarators.map((d) => declare(stmt.type, d))
        return { facts: declared.flatMap((e) => e.facts), changed: declared.flatMap((e) => e.changed) }
      }
      if (stmt.kind === 'assign' || stmt.kind === 'update' || stmt.kind === 'expr') return runSimple(stmt)
      throw new CodeError(stmt.line, 'codeError.forHeader')
    })
    return { facts: effects.flatMap((e) => e.facts), changed: effects.flatMap((e) => e.changed) }
  }

  function runStatements(body: Stmt[]): Jump | null {
    for (const stmt of body) {
      const jump = run(stmt)
      if (jump) return jump
    }
    return null
  }

  function run(stmt: Stmt): Jump | null {
    switch (stmt.kind) {
      case 'declare':
        for (const d of stmt.declarators) {
          const { facts, changed } = declare(stmt.type, d)
          emit(d.line, facts[0], changed)
        }
        return null

      case 'expr':
        // A call on its own line, like `greet();`, is shown through its call and return steps
        // (srand() records its own step). A lone `rand();` falls through and is shown as an expression.
        if (stmt.expr.kind === 'call' && (stmt.expr.name !== 'rand' || program.functions.has('rand'))) {
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
        const text = stmt.format.replace(/%[dfcsp%]/g, (placeholder) => {
          if (placeholder === '%%') return '%'
          const arg = stmt.args[argIndex++]
          if (arg.kind === 'string') return arg.value
          if (placeholder === '%s' && arg.kind === 'var') {
            return readText(arg.name, stmt.line, () =>
              stmt.isPuts
                ? new CodeError(stmt.line, 'codeError.putsText')
                : new CodeError(stmt.line, 'codeError.printfSNotText', { arg: arg.name }),
            )
          }
          // %p prints the same made-up address the Variables panel shows (e.g. 0x104), or NULL.
          if (placeholder === '%p') {
            const target = pointerValue(arg, () => new CodeError(stmt.line, 'codeError.printfPointer', { arg: toSource(arg) }))
            return showPointer(target)
          }
          const value = evaluate(arg)
          const values = { arg: toSource(arg) }
          // %d also prints a char, as its character code.
          if (placeholder === '%d' && value.type === 'float') throw new CodeError(stmt.line, 'codeError.printfIntGotFloat', values)
          if (placeholder === '%c' && value.type === 'float') throw new CodeError(stmt.line, 'codeError.printfCharGotFloat', values)
          if (placeholder === '%f' && value.type === 'int') throw new CodeError(stmt.line, 'codeError.printfFloatGotInt', values)
          if (placeholder === '%f' && value.type === 'char') throw new CodeError(stmt.line, 'codeError.printfFloatGotChar', values)
          if (placeholder === '%c') return value.value === 0 ? '' : String.fromCharCode(value.value & 0xff)
          return placeholder === '%d' ? String(value.value) : value.value.toFixed(6)
        })
        output += text
        emit(stmt.line, { kind: 'print', text })
        return null
      }

      // Each value read is its own step, so scanf("%d %d", &a, &b) shows a and b filled one after the other.
      case 'scanf': {
        stmt.reads.forEach(({ specifier, target: targetExpr }, i) => {
          const fail = (key: TranslationKey, values: Phrase['values']) =>
            scanfReadError(stmt.line, i + 1, stmt.reads.length, key, values)

          if (inputUsed >= input.length) {
            throw fail('codeError.scanfNoInput', { needed: inputUsed + 1, given: input.length })
          }
          const text = input[inputUsed++]
          if (specifier === 's') {
            const name = targetExpr.name
            scanText(name, text, stmt.line, fail)
            emit(stmt.line, { kind: 'scanText', name, text: quoteText(text), count: text.length }, [name])
            return
          }
          const target = resolveTarget(targetExpr)
          if (target.type === 'char') {
            throw fail('codeError.scanfIntoChar', { target: toSource(targetExpr), specifier: `%${specifier}` })
          }
          if (specifier === 'd' && target.type !== 'int') {
            throw fail('codeError.scanfIntIntoFloat', { target: toSource(targetExpr) })
          }
          if (specifier === 'f' && target.type !== 'float') {
            throw fail('codeError.scanfFloatIntoInt', { target: toSource(targetExpr) })
          }
          const isValid = specifier === 'd' ? /^[+-]?\d+$/.test(text) : /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(text)
          if (!isValid) {
            throw fail(specifier === 'd' ? 'codeError.scanfNotInt' : 'codeError.scanfNotNumber', { value: text })
          }
          const stored = target.write(Number(text))
          emit(stmt.line, { kind: 'scan', target: target.label, value: formatNumber(stored, target.type) }, [target.changed])
        })
        return null
      }

      case 'block': {
        frame().scopes.push(new Map())
        const jump = runStatements(stmt.body)
        endScope(frame().scopes.pop()!)
        return jump
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

      case 'break':
        emit(stmt.line, { kind: 'break' })
        return { kind: 'break' }

      case 'continue': {
        const loop = frame().loops[frame().loops.length - 1]
        emit(stmt.line, { kind: 'continue', toUpdate: loop.hasUpdate })
        return { kind: 'continue' }
      }

      case 'return': {
        const fn = frame().fn
        if (stmt.value && fn.returnType === 'void') throw new CodeError(stmt.line, 'codeError.voidReturn', { name: fn.name })
        if (!stmt.value && fn.returnType !== 'void') {
          throw new CodeError(stmt.line, 'codeError.mustReturn', { name: fn.name, type: fn.returnType })
        }

        if (!stmt.value || fn.returnType === 'void') {
          emit(stmt.line, { kind: 'return', name: fn.name, value: null, caller: callerName() })
          return { kind: 'return', value: null }
        }
        const value = evaluate(stmt.value)
        const result = convert(value.value, fn.returnType)
        const shown = { source: toSource(stmt.value), work: value.work, result: formatNumber(result, fn.returnType) }
        emit(stmt.line, { kind: 'return', name: fn.name, value: shown, caller: callerName() })
        return { kind: 'return', value: result }
      }
    }
  }

  /**
   * scanf("%s", name): stores one word from the Input field in the char array `name`,
   * followed by the \0 that marks where the text ends.
   */
  function scanText(name: string, text: string, line: number, fail: (key: TranslationKey, values: Phrase['values']) => CodeError) {
    const slot = lookup(name, line)
    if (slot.kind !== 'array' || slot.type !== 'char') throw fail('codeError.scanfSNotText', { target: name })
    const nonAscii = [...text].find((char) => char.length > 1 || char.charCodeAt(0) > 127)
    if (nonAscii) throw fail('codeError.nonAsciiChar', { char: nonAscii })
    const size = slot.values.length
    if (text.length + 1 > size) {
      throw fail('codeError.scanfTooLong', { value: text, count: text.length, name, size, room: size - 1 })
    }
    charCodes(text, line).forEach((c, i) => (slot.values[i] = c))
    slot.values[text.length] = 0
    access = { name, store: slot, active: null }
  }

  function runLoop(stmt: Extract<Stmt, { kind: 'while' | 'for' }>): Jump | null {
    const current = frame()
    current.scopes.push(new Map()) // holds `i` from `for (int i = 0; ...)`
    const loop: LoopRun = { iteration: 0, infos: [], hasUpdate: stmt.kind === 'for' && stmt.update.length > 0 }
    current.loops.push(loop)

    let setup = runLoopPart(stmt.kind === 'for' ? stmt.init : [])
    let isFirst = true
    let returned: Jump | null = null

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
      // A condition like `arr[i] != 0` already highlights the element it reads.
      const checkUsesArray = access !== null
      emit(stmt.line, { kind: 'loopCheck', setup: setup.facts, isFirst, condition, result }, setup.changed)
      isFirst = false
      if (!result) break

      if (!checkUsesArray) pendingCheck = { step: steps[steps.length - 1], frame: current, arrays: arraysInScope() }

      // `continue` just goes on to the update and the next check, like reaching the end of the body.
      const jump = run(stmt.body)
      if (jump?.kind === 'return' || jump?.kind === 'break') {
        current.loops.pop()
        if (jump.kind === 'return') returned = jump
        break
      }
      setup = runLoopPart(stmt.kind === 'for' ? stmt.update : [])
    }

    for (const info of loop.infos) info.total = loop.iteration
    endScope(current.scopes.pop()!)
    return returned
  }
}
