import type { TranslationKey } from '../i18n/translations'
import { CodeError, UnsupportedConstructError, code, scanfReadError, type RunError } from './errors'
import { explain, type PointsTo, type Shown, type StepFact } from './explain'
import {
  arithmetic,
  convert,
  formatNumber,
  MAX_ARRAY_SIZE,
  needsParens,
  parse,
  pointerError,
  quoteText,
  sizeofError,
  stringError,
  stringResultError,
  toSource,
  typeText,
  writesText,
  type Accessor,
  type BinaryOp,
  type Declarator,
  type Expr,
  type FunctionDecl,
  type Init,
  type NumType,
  type Program,
  type Stmt,
  type StructDeclarator,
  type StructDef,
  type SwitchLabel,
  type Target,
  type ValueType,
} from './parser'
import {
  variableKey,
  type AnyArrayView,
  type FieldView,
  type GridCell,
  type LoopInfo,
  type Phrase,
  type Step,
  type Variable,
} from './types'

/** Programs are stopped after this many steps, so a loop that never ends can't freeze the page. */
export const MAX_STEPS = 1000

/** The bytes one value of each type takes for sizeof, as with the usual C compilers (char is always 1). */
export const TYPE_SIZES: Record<NumType, number> = { int: 4, float: 4, char: 1 }

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

// Common C library functions, so calling one gives "not supported yet" rather than "doesn't exist".
const libraryFunctions = new Set([
  'putchar', 'getchar', 'gets', 'fgets', 'fprintf', 'sprintf',
  'malloc', 'calloc', 'realloc', 'free', 'exit', 'abs', 'atoi',
  'strncmp', 'strncpy', 'strchr', 'strstr', 'strtok', 'memset', 'memcpy', 'snprintf',
  'sqrt', 'pow', 'fabs', 'floor', 'ceil', 'sin', 'cos', 'tan', 'log', 'exp',
  'isalnum', 'ispunct', 'isxdigit', 'isprint', 'isgraph', 'iscntrl', 'isblank',
])

const isUpper = (c: number) => c >= 65 && c <= 90 // 'A' to 'Z'
const isLower = (c: number) => c >= 97 && c <= 122 // 'a' to 'z'
/** How far a lowercase letter's code is from its uppercase one: 'a' (97) - 'A' (65). */
const CASE_DISTANCE = 32

/** The <ctype.h> checks. `what` names what they look for, for the explanation. */
const ctypeTests = new Map<string, { matches: (c: number) => boolean; what: Phrase }>([
  ['isdigit', { matches: (c) => c >= 48 && c <= 57, what: { key: 'explain.ctypeDigit' } }], // '0' to '9'
  ['isalpha', { matches: (c) => isUpper(c) || isLower(c), what: { key: 'explain.ctypeLetter' } }],
  ['isupper', { matches: isUpper, what: { key: 'explain.ctypeUpper' } }],
  ['islower', { matches: isLower, what: { key: 'explain.ctypeLower' } }],
  // ' ', and \t \n \v \f \r, which are codes 9 to 13.
  ['isspace', { matches: (c) => c === 32 || (c >= 9 && c <= 13), what: { key: 'explain.ctypeSpace' } }],
])

/** toupper() and tolower(). `what` names the only characters they change, for the explanation. */
const ctypeConversions = new Map<string, { applies: (c: number) => boolean; distance: number; what: Phrase }>([
  ['toupper', { applies: isLower, distance: -CASE_DISTANCE, what: { key: 'explain.ctypeLower' } }],
  ['tolower', { applies: isUpper, distance: CASE_DISTANCE, what: { key: 'explain.ctypeUpper' } }],
])

const isCtypeFunction = (name: string) => ctypeTests.has(name) || ctypeConversions.has(name)

/** The <string.h> functions that give a value. strcpy and strcat write into a char array instead. */
const givesStringValue = (name: string) => name === 'strlen' || name === 'strcmp'

/** A character's code as strcmp compares it, which is as an unsigned char. Past the end of the text is the \0. */
const compareCode = (text: string, index: number) => (text.charCodeAt(index) || 0) & 0xff

/** `ended` is set once the block that declared the variable is over, so a pointer to it can't be followed. */
type Scalar = { kind: 'scalar'; type: NumType; value: number | null; address: number; ended?: true }
/** The variable a pointer points to: the slot itself (it may live in another call), plus its name. */
type PointerTarget = { name: string; slot: Scalar | StructStore }
/**
 * `int *p` / `struct Point *p`: points to a variable of `type` (the pointee's type), or 'NULL', or null
 * before it gets an address.
 */
type PointerStore = { kind: 'pointer'; type: ValueType; target: PointerTarget | 'NULL' | null; address: number; ended?: true }
/** Arrays are shared by reference, so a function that receives one changes the caller's array. */
type ArrayStore = { kind: 'array'; type: NumType; values: number[] }
/** A 2D array: one inner array per row. Shared by reference, like ArrayStore. */
type GridStore = { kind: 'grid'; type: NumType; values: number[][] }
/**
 * One field of a struct value: a single value (null until it is given one), a 1D array (whose `kind`,
 * `type` and `values` make it usable wherever an ArrayStore is), or a struct of its own.
 */
type FieldSlot =
  | { kind: 'scalar'; name: string; type: NumType; value: number | null }
  | { kind: 'array'; name: string; type: NumType; values: number[] }
  | { kind: 'struct'; name: string; value: StructValue }
/** The fields of one struct: a struct variable's, one element's of an array of structs, or a struct field's. */
type StructValue = { def: StructDef; fields: FieldSlot[] }
/**
 * `struct Point p`: every struct variable has its own fields, so `p2 = p1;` copies the values
 * (unlike an array, which a function receives by reference).
 */
type StructStore = StructValue & { kind: 'struct'; address: number; ended?: true }
/** `struct Point pts[3]`: one StructValue per element. Shared by reference, like any array. */
type StructArrayStore = { kind: 'structArray'; def: StructDef; items: StructValue[] }
type Slot = Scalar | PointerStore | ArrayStore | GridStore | StructStore | StructArrayStore

/**
 * Where a value lives, as found by following a path like `students[i].marks[j]` (see placeOf). `label` is
 * how the explanation writes it, with indexes worked out ("students[1].marks[2]"); `changed` is what
 * `Step.changed` names when it is written.
 */
type Place =
  | { kind: 'scalar'; label: string; changed: string; type: NumType; get: () => number | null; set: (value: number) => number }
  | { kind: 'array'; label: string; changed: string; store: ArrayStore }
  | { kind: 'grid'; label: string; changed: string; store: GridStore }
  | { kind: 'struct'; label: string; changed: string; value: StructValue }
  | { kind: 'structArray'; label: string; changed: string; store: StructArrayStore }
  | { kind: 'pointer'; label: string; changed: string; slot: PointerStore }

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
 * a `return` (its value, null for `void`) up to the function, a `break` up to the innermost loop or switch,
 * and a `continue` up to the innermost loop.
 */
type Jump = { kind: 'return'; value: number | StructValue | null } | { kind: 'break' } | { kind: 'continue' }

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

/** The text in a char array: its characters up to the first \0, or null when there is no \0. */
function textOf(values: number[]): string | null {
  const end = values.indexOf(0)
  return end === -1 ? null : String.fromCharCode(...values.slice(0, end))
}

function formatSlot(slot: Slot): string {
  if (slot.kind === 'struct') return formatStruct(slot)
  // An array of structs is drawn element by element in the array view, so its box only sums it up: [{…}, {…}].
  if (slot.kind === 'structArray') return `[${slot.items.map(() => '{…}').join(', ')}]`
  if (slot.kind === 'array') return formatRow(slot.type, slot.values)
  if (slot.kind === 'grid') return `[${slot.values.map((row) => formatRow(slot.type, row)).join(', ')}]`
  // A pointer holds the address of the variable it points to.
  if (slot.kind === 'pointer') return slot.target === null ? '?' : showPointer(slot.target)
  return slot.value === null ? '?' : formatNumber(slot.value, slot.type)
}

/** A 1D array's values, "[1, 2, 3]", or for a char array the text it holds, e.g. "hello". */
function formatRow(type: NumType, row: number[]): string {
  if (type === 'char') return quoteText(textOf(row) ?? String.fromCharCode(...row))
  return `[${row.map((v) => formatNumber(v, type)).join(', ')}]`
}

/** A struct in one line, the way a debugger prints it: {x = 1, y = 2}. The panel draws its fields one by one. */
function formatStruct(value: StructValue): string {
  return `{${value.fields.map((field) => `${field.name} = ${formatField(field)}`).join(', ')}}`
}

function formatField(field: FieldSlot): string {
  if (field.kind === 'array') return formatRow(field.type, field.values)
  if (field.kind === 'struct') return formatStruct(field.value)
  return field.value === null ? '?' : formatNumber(field.value, field.type)
}

/** A struct's fields for the Variables panel and the array view, a struct field with its own fields. */
function fieldViews(value: StructValue): FieldView[] {
  return value.fields.map((field) =>
    field.kind === 'struct'
      ? { name: field.name, value: formatField(field), fields: fieldViews(field.value) }
      : { name: field.name, value: formatField(field) },
  )
}

/** "x = 1", "y = ?": each field of a struct with its value, for an explanation. */
function fieldValues(value: StructValue): Phrase[] {
  return value.fields.map((field) => code(`${field.name} = ${formatField(field)}`))
}

/** A struct value of type `def` whose fields have no values yet, or are all 0 (`zero`). Array fields start at 0, like arrays. */
function newStruct(def: StructDef, zero: boolean): StructValue {
  return {
    def,
    fields: def.fields.map((field): FieldSlot => {
      if (field.kind === 'scalar') return { kind: 'scalar', name: field.name, type: field.type, value: zero ? 0 : null }
      if (field.kind === 'array') return { kind: 'array', name: field.name, type: field.type, values: new Array<number>(field.size).fill(0) }
      return { kind: 'struct', name: field.name, value: newStruct(field.def, zero) }
    }),
  }
}

/** A separate copy of a struct value, array and struct fields included, as `q = p;` makes in C. */
function copyStructValue(value: StructValue): StructValue {
  return { def: value.def, fields: value.fields.map(copyField) }
}

function copyField(field: FieldSlot): FieldSlot {
  if (field.kind === 'array') return { ...field, values: [...field.values] }
  if (field.kind === 'struct') return { ...field, value: copyStructValue(field.value) }
  return { ...field }
}

/** Copies every field of `source` into `dest` in place, so pointers to `dest` still see it. */
function assignFields(dest: StructValue, source: StructValue) {
  source.fields.forEach((field, i) => (dest.fields[i] = copyField(field)))
}

/** The type a pointer to this variable must have: its own int / float / char, or its struct type. */
function pointeeType(slot: Scalar | StructStore): ValueType {
  return slot.kind === 'struct' ? slot.def : slot.type
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
  for (const slot of scope.values()) {
    if (slot.kind === 'scalar' || slot.kind === 'pointer' || slot.kind === 'struct') slot.ended = true
  }
}

/** An array the array view can show. */
type ViewStore = ArrayStore | GridStore | StructArrayStore

/**
 * What the array view shows for an array, with `active` as the element or cell in use, and for an
 * array of structs `field` as the active element's field the line uses.
 */
function arrayView(name: string, store: ViewStore, active: number | GridCell | null, field?: string): AnyArrayView {
  if (store.kind === 'structArray') {
    return {
      kind: 'structs',
      name,
      structType: store.def.name,
      items: store.items.map(fieldViews),
      activeIndex: typeof active === 'number' ? active : null,
      ...(field !== undefined && typeof active === 'number' ? { activeField: field } : {}),
    }
  }
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
  let access: { name: string; store: ViewStore; active: number | GridCell | null; field?: string } | null = null
  /** 2D cells the current statement read and rand() numbers it got, explained before what the statement did. */
  let cellReads: StepFact[] = []
  /**
   * A loop check whose body runs next, with the arrays as they were at the check. If the body's
   * first step uses an array element, the check highlights it too, one step early, the same way
   * the hand-authored examples do.
   */
  let pendingCheck: { step: Step; frame: Frame; arrays: Map<string, ViewStore> } | null = null

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
    let firstArray: AnyArrayView | null = null
    for (const scope of current.scopes) {
      for (const [name, slot] of scope) {
        variables.set(name, showVariable(name, slot))
        shownSlots.set(name, slot)
        if ((slot.kind === 'array' || slot.kind === 'grid' || slot.kind === 'structArray') && !firstArray) firstArray = arrayView(name, slot, null)
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
      if (access && before) pendingCheck.step.array = arrayView(access.name, before, access.active, access.field)
      pendingCheck = null
    }

    const loopRun = current.loops[current.loops.length - 1]
    steps.push({
      line,
      scope: `${current.fn.name}()`,
      variables: [...variables.values()],
      changed,
      array: access ? arrayView(access.name, access.store, access.active, access.field) : firstArray,
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
    // A struct is shown as one box holding its fields, so the panel needs each field on its own.
    if (slot.kind === 'struct') {
      variable.structType = slot.def.name
      variable.fields = fieldViews(slot)
    }
    if (slot.kind === 'structArray') {
      variable.structType = slot.def.name
      variable.length = slot.items.length
    }
    if (!program.usesPointers || slot.kind === 'array' || slot.kind === 'grid' || slot.kind === 'structArray') return variable
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
  function arraysInScope(): Map<string, ViewStore> {
    const arrays = new Map<string, ViewStore>()
    for (const scope of frame().scopes) {
      for (const [name, slot] of scope) {
        if (slot.kind === 'array') arrays.set(name, { ...slot, values: [...slot.values] })
        if (slot.kind === 'grid') arrays.set(name, { ...slot, values: slot.values.map((row) => [...row]) })
        if (slot.kind === 'structArray') arrays.set(name, { ...slot, items: slot.items.map(copyStructValue) })
      }
    }
    return arrays
  }

  // ----- Functions -----

  /** Runs a function body. `callFact` is null for main, which starts without a "call" step. */
  function runFunction(fn: FunctionDecl, params: Map<string, Slot>, callFact: StepFact | null): number | StructValue | null {
    frames.push({ fn, scopes: [params], loops: [] })
    if (callFact) emit(fn.line, callFact, fn.params.map((p) => p.name))

    // The parser only allows break and continue inside a loop or switch, so only a return gets this far.
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

  /** Calls a function from an expression that needs a number. Returns null for a void function. */
  function evaluateCall(expr: Extract<Expr, { kind: 'call' }>): Value | null {
    const result = callFunction(expr)
    if (result && 'def' in result) {
      throw new CodeError(expr.line, 'codeError.callIsStruct', { call: toSource(expr), type: result.def.name, field: result.def.fields[0].name })
    }
    return result
  }

  /** Calls a function, which may give back a number, a struct (`struct Point make()`), or nothing. */
  function callFunction(expr: Extract<Expr, { kind: 'call' }>): Value | StructValue | null {
    const fn = program.functions.get(expr.name)
    if (!fn) {
      if (expr.name === 'rand' || expr.name === 'srand') return evaluateRandomCall(expr)
      if (expr.name === 'time') return evaluateTime(expr)
      if (isCtypeFunction(expr.name)) return evaluateCtype(expr)
      if (givesStringValue(expr.name) || writesText(expr.name)) return evaluateString(expr)
      if (libraryFunctions.has(expr.name)) {
        throw new UnsupportedConstructError(
          expr.line,
          code(`${expr.name}()`),
          { key: 'unsupported.libraryFunction', values: { name: expr.name } },
        )
      }
      throw new CodeError(expr.line, 'codeError.noFunction', { name: expr.name })
    }
    const text = expr.args.find((arg) => arg.kind === 'string')
    if (text) throw stringError(text.line)
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
      } else if (param.isArray && typeof param.type !== 'string') {
        // An array of structs is shared like any array: the function changes the caller's elements.
        const slot = arg.kind === 'var' ? lookup(arg.name, arg.line) : null
        if (!slot || slot.kind !== 'structArray' || arg.kind !== 'var') {
          throw new CodeError(expr.line, 'codeError.expectsStructArray', { fn: fn.name, param: param.name, type: param.type.name })
        }
        if (slot.def !== param.type) {
          throw new CodeError(expr.line, 'codeError.arrayTypeMismatch', {
            param: param.name,
            paramType: typeText(param.type),
            arg: arg.name,
            argType: typeText(slot.def),
          })
        }
        params.set(param.name, slot)
        args.push(arg.name)
        shownParams.push({ name: param.name, value: arg.name, isArray: true })
      } else if (typeof param.type !== 'string') {
        // A struct is passed by value: the parameter is a new struct with a copy of every field.
        const def = param.type
        const source = structValueOf(arg)
        if (!source || source.def !== def) {
          throw new CodeError(expr.line, 'codeError.expectsStruct', { fn: fn.name, param: param.name, type: def.name, arg: toSource(arg) })
        }
        const slot: StructStore = { kind: 'struct', ...copyStructValue(source), address: newAddress() }
        params.set(param.name, slot)
        args.push(toSource(arg))
        shownParams.push({ name: param.name, value: formatStruct(slot), isArray: false, copyOf: toSource(arg) })
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
    if (typeof result !== 'number' || typeof fn.returnType !== 'string') return result as StructValue
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
   * A <ctype.h> function. It takes a character code and gives an int, as in C, so `toupper('a')` is 65:
   * `%c` prints it as A, and storing it in a char shows 'A'. Checks give 1 or 0; real C only promises
   * "not 0", but one fixed number is easier to follow in a trace.
   */
  function evaluateCtype(expr: Extract<Expr, { kind: 'call' }>): Value {
    if (expr.args.length !== 1) {
      throw new CodeError(expr.line, 'codeError.argCount', { name: expr.name, expected: 1, given: expr.args.length })
    }
    const c = convert(evaluate(expr.args[0]).value, 'int')
    const arg = formatNumber(c, 'char')
    const call = `${expr.name}(${arg})`

    const test = ctypeTests.get(expr.name)
    if (test) {
      const passed = test.matches(c)
      cellReads.push({ kind: 'ctypeTest', call, arg, passed, what: test.what })
      const value = passed ? 1 : 0
      return { type: 'int', value, work: String(value) }
    }

    const conversion = ctypeConversions.get(expr.name)!
    const changed = conversion.applies(c)
    const value = changed ? c + conversion.distance : c
    cellReads.push({ kind: 'ctypeConvert', call, arg, result: formatNumber(value, 'char'), code: value, changed, what: conversion.what })
    return { type: 'int', value, work: String(value) }
  }

  /** Whether this is the real strcpy or strcat, not a function of the student's with the same name. */
  function isTextWriter(name: string): boolean {
    return writesText(name) && !program.functions.has(name)
  }

  /**
   * A <string.h> function. strlen and strcmp give an int, and each call adds a note to its line's
   * explanation, like the <ctype.h> functions. strcpy and strcat give nothing here: they get their own step.
   */
  function evaluateString(expr: Extract<Expr, { kind: 'call' }>): Value | null {
    const expected = expr.name === 'strlen' ? 1 : 2
    if (expr.args.length !== expected) {
      throw new CodeError(expr.line, 'codeError.argCount', { name: expr.name, expected, given: expr.args.length })
    }
    if (writesText(expr.name)) {
      writeText(expr)
      return null
    }

    const first = textArgument(expr.name, expr.args[0])
    if (expr.name === 'strlen') {
      cellReads.push({ kind: 'strlen', call: `strlen(${quoteText(first)})`, count: first.length })
      return { type: 'int', value: first.length, work: String(first.length) }
    }

    const second = textArgument(expr.name, expr.args[1])
    let index = 0
    while (index < first.length && first[index] === second[index]) index++
    const firstCode = compareCode(first, index)
    const secondCode = compareCode(second, index)
    const value = firstCode - secondCode
    cellReads.push({
      kind: 'strcmp',
      call: `strcmp(${quoteText(first)}, ${quoteText(second)})`,
      result: value,
      index,
      first: formatNumber(firstCode, 'char'),
      firstCode,
      second: formatNumber(secondCode, 'char'),
      secondCode,
    })
    return { type: 'int', value, work: String(value) }
  }

  /**
   * strcpy(dest, src) or strcat(dest, src). A whole-array write works like scanf("%s"): the characters go
   * into the array's own values and the step names it in `changed`, so the Variables panel and the array
   * view show the new text the same way as after `s[i] = 'a';`. What was in dest after the new \0 stays.
   */
  function writeText(expr: Extract<Expr, { kind: 'call' }>) {
    const [dest, source] = expr.args
    const notDest = () => new CodeError(expr.line, 'codeError.stringDest', { fn: expr.name })
    rejectUnsupportedText(dest)
    const place = textPlace(dest)
    if (!place) throw notDest()
    const { label: name, store } = place

    // The source is read first, so the text is the same even when both arguments are one array.
    const text = textArgument(expr.name, source)
    const start = expr.name === 'strcat' ? textIn(place, expr.line).length : 0
    const count = start + text.length
    const size = store.values.length
    if (count + 1 > size) {
      throw new CodeError(expr.line, 'codeError.stringNoRoom', { fn: expr.name, needed: count + 1, count, name, size })
    }
    for (let i = 0; i < text.length; i++) store.values[start + i] = convert(text.charCodeAt(i), store.type)
    store.values[count] = 0

    access = { name, store, active: null }
    const fact: StepFact =
      expr.name === 'strcpy'
        ? { kind: 'strcpy', name, text: quoteText(text), count }
        : { kind: 'strcat', name, text: quoteText(text), start, result: quoteText(textOf(store.values) ?? ''), count }
    emit(expr.line, fact, [place.changed])
  }

  /** The text of a <string.h> argument: a "string", or a char array named on its own or a char array field. */
  function textArgument(fn: string, arg: Expr): string {
    if (arg.kind === 'string') {
      charCodes(arg.value, arg.line) // Checks that it is plain ASCII.
      return arg.value
    }
    rejectUnsupportedText(arg)
    return readText(arg, arg.line, () => new CodeError(arg.line, 'codeError.stringArg', { fn }))
  }

  /** Text arguments that are fine in real C but need a pointer into an array, which this version doesn't have. */
  function rejectUnsupportedText(arg: Expr) {
    if (arg.kind === 'call' && isTextWriter(arg.name)) throw stringResultError(arg.line, arg.name)
    if (arg.kind === 'binary' && arg.left.kind === 'var' && findSlot(arg.left.name)?.kind === 'array') {
      throw pointerError(arg.line, 'unsupported.pointerArithmetic')
    }
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

  /**
   * `sizeof`: the bytes a type, variable or array takes. As in C it is worked out from the type alone,
   * so the variable needs no value yet and an index like `arr[i]` is never run.
   */
  function evaluateSizeof(expr: Extract<Expr, { kind: 'sizeof' }>): Value {
    const { of } = expr
    const source = toSource(expr)
    let fact: Extract<StepFact, { kind: 'sizeof' }>
    if (typeof of === 'string') {
      fact = { kind: 'sizeof', source, type: of, size: TYPE_SIZES[of], count: null, isRow: false }
    } else {
      const slot = lookup(of.name, of.line)
      if (slot.kind === 'pointer') throw sizeofError(expr.line, 'Pointer')
      if (slot.kind === 'struct' || slot.kind === 'structArray') throw sizeofError(expr.line, 'Struct')
      // An array parameter only holds the caller's array's address, so real C would give that address's size.
      const isParam = frame().scopes[0].get(of.name) === slot && frame().fn.params.some((p) => p.name === of.name)
      if (slot.kind !== 'scalar' && isParam) throw sizeofError(expr.line, 'ArrayParam', { name: of.name })

      const element = TYPE_SIZES[slot.type]
      if (of.kind === 'var') {
        const count = slot.kind === 'array' ? slot.values.length : slot.kind === 'grid' ? slot.values.length * slot.values[0].length : null
        fact = { kind: 'sizeof', source, type: slot.type, size: element * (count ?? 1), count, isRow: false }
      } else if (of.kind === 'index' && slot.kind === 'array') {
        fact = { kind: 'sizeof', source, type: slot.type, size: element, count: null, isRow: false }
      } else if (of.kind === 'index' && slot.kind === 'grid') {
        const count = slot.values[0].length
        fact = { kind: 'sizeof', source, type: slot.type, size: element * count, count, isRow: true }
      } else if (of.kind === 'cell' && slot.kind === 'grid') {
        fact = { kind: 'sizeof', source, type: slot.type, size: element, count: null, isRow: false }
      } else if (of.kind === 'cell') {
        throw new CodeError(of.line, slot.kind === 'array' ? 'codeError.arrayNeedsOne' : 'codeError.notGrid', { name: of.name })
      } else {
        throw new CodeError(of.line, 'codeError.notArray', { name: of.name })
      }
    }
    cellReads.push(fact)
    return { type: 'int', value: fact.size, work: String(fact.size) }
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
    if (slot.kind === 'array' || slot.kind === 'structArray') throw new CodeError(line, 'codeError.isArray', { name })
    if (slot.kind === 'grid') throw new CodeError(line, 'codeError.isGrid', { name })
    if (slot.kind === 'pointer') throw new CodeError(line, 'codeError.pointerAsNumber', { name, deref: `*${name}` })
    if (slot.kind === 'struct') throw isStructError(name, slot.def, line)
    if (slot.value === null) throw new CodeError(line, 'codeError.noValue', { name })
    return { type: slot.type, value: slot.value, work: formatNumber(slot.value, slot.type) }
  }

  // ----- Structs -----

  /** A struct used where one value is expected, e.g. `p + 1` or `printf("%d", p)`. `name` is how the code writes it. */
  function isStructError(name: string, def: StructDef, line: number): CodeError {
    return new CodeError(line, 'codeError.isStruct', { name, type: def.name, field: def.fields[0].name })
  }

  /** A variable as the start of a path. */
  function slotPlace(name: string, slot: Slot): Place {
    const at = { label: name, changed: name }
    switch (slot.kind) {
      case 'scalar':
        return { kind: 'scalar', ...at, type: slot.type, get: () => slot.value, set: (value) => (slot.value = convert(value, slot.type)) }
      case 'array':
        return { kind: 'array', ...at, store: slot }
      case 'grid':
        return { kind: 'grid', ...at, store: slot }
      case 'struct':
        return { kind: 'struct', ...at, value: slot }
      case 'structArray':
        return { kind: 'structArray', ...at, store: slot }
      case 'pointer':
        return { kind: 'pointer', ...at, slot }
    }
  }

  /**
   * Follows a path like `students[i].marks[j]`, `p->gpa` or `a.born.day` from its variable, checking that
   * each step fits: `.` needs a struct, `->` a pointer to a struct, `[ ]` an array. The innermost array it
   * indexes becomes this step's array access, so the array view shows that element.
   */
  function placeOf(expr: Extract<Expr, { kind: 'var' | 'index' | 'cell' | 'member' }>): Place {
    let path: Accessor[] = []
    if (expr.kind === 'index') path = [{ kind: 'index', index: expr.index }]
    if (expr.kind === 'cell') path = [{ kind: 'index', index: expr.row }, { kind: 'index', index: expr.col }]
    if (expr.kind === 'member') path = expr.path

    let place = slotPlace(expr.name, lookup(expr.name, expr.line))
    // `(*p).x` starts at the struct p points to, the same as p->x.
    if (expr.kind === 'member' && expr.deref) place = followStructPointer(place, expr.name, expr.line, firstField(path), true)
    // Past an array element, a write is shown on that whole array, the same way `arr[i] = 1;` names arr.
    let inArray = false

    path.forEach((accessor, i) => {
      if (accessor.kind === 'index') {
        place = indexInto(place, accessor.index, expr.line, path[i + 1])
        inArray = true
        return
      }
      const { field, arrow } = accessor
      if (arrow) place = followStructPointer(place, expr.name, expr.line, field, false)
      else if (place.kind === 'pointer' && typeof place.slot.type !== 'string') {
        throw new CodeError(expr.line, 'codeError.dotOnPointer', { name: place.label, field })
      }
      if (place.kind !== 'struct') throw new CodeError(expr.line, 'codeError.notStruct', { name: place.label, field })
      const value = place.value
      const slot = value.fields.find((f) => f.name === field)
      if (!slot) {
        throw new CodeError(expr.line, 'codeError.noField', {
          type: value.def.name,
          field,
          fields: value.def.fields.map((f) => code(f.name)),
        })
      }
      const label = `${place.label}${arrow ? '->' : '.'}${field}`
      const changed = inArray ? place.changed : `${place.changed}.${field}`
      place = fieldPlace(slot, label, changed)
    })
    return place
  }

  /** The first field a member path names, e.g. "x" in `(*p).x`. */
  function firstField(path: Accessor[]): string {
    const first = path.find((a) => a.kind === 'field')
    return first?.kind === 'field' ? first.field : ''
  }

  /**
   * `p->x` or `(*p).x` (`isDeref`): the struct the pointer p points to. Only a pointer to a struct can be
   * followed this way, and only a variable can be one, so the pointer is always the path's own variable.
   */
  function followStructPointer(place: Place, name: string, line: number, field: string, isDeref: boolean): Place {
    if (place.kind !== 'pointer' || typeof place.slot.type === 'string') {
      throw new CodeError(line, 'codeError.arrowNotPointer', { name: place.label, field })
    }
    const pointee = follow(name, line)
    if (pointee.slot.kind !== 'struct') throw new CodeError(line, 'codeError.arrowNotPointer', { name: place.label, field })
    const source = isDeref ? `(*${name}).${field}` : `${name}->${field}`
    // `s->gpa = s->gpa + 1` uses it twice, but one note is enough.
    if (!cellReads.some((fact) => fact.kind === 'arrow' && fact.source === source)) {
      cellReads.push({ kind: 'arrow', pointer: name, source, target: pointee.name, field })
    }
    return { kind: 'struct', label: isDeref ? `(*${name})` : name, changed: pointeeKey(pointee), value: pointee.slot }
  }

  /** One field of a struct, as a place. */
  function fieldPlace(slot: FieldSlot, label: string, changed: string): Place {
    if (slot.kind === 'array') return { kind: 'array', label, changed, store: slot }
    if (slot.kind === 'struct') return { kind: 'struct', label, changed, value: slot.value }
    return { kind: 'scalar', label, changed, type: slot.type, get: () => slot.value, set: (value) => (slot.value = convert(value, slot.type)) }
  }

  /** `[i]` on a place: an element of an array, an array field, a row of a 2D array, or an array of structs. */
  function indexInto(place: Place, indexExpr: Expr, line: number, next: Accessor | undefined): Place {
    const { label, changed } = place
    const outside = (size: number) => (i: number) => ({ key: 'codeError.indexOutside' as const, values: { name: label, index: i, size, last: size - 1 } })
    if (place.kind === 'structArray') {
      const { store } = place
      const index = evaluateIndex(indexExpr, store.items.length, line, outside(store.items.length))
      access = { name: label, store, active: index, field: next?.kind === 'field' ? next.field : undefined }
      return { kind: 'struct', label: `${label}[${index}]`, changed, value: store.items[index] }
    }
    if (place.kind === 'grid') {
      // A row of a 2D array, which the next [ ] indexes like a 1D array.
      const rows = place.store.values
      const row = evaluateIndex(indexExpr, rows.length, line, outside(rows.length))
      return { kind: 'array', label: `${label}[${row}]`, changed, store: { kind: 'array', type: place.store.type, values: rows[row] } }
    }
    if (place.kind !== 'array') throw new CodeError(line, 'codeError.notArray', { name: label })
    const array = place.store
    const index = evaluateIndex(indexExpr, array.values.length, line, outside(array.values.length))
    access = { name: label, store: array, active: index }
    return {
      kind: 'scalar',
      label: `${label}[${index}]`,
      changed,
      type: array.type,
      get: () => array.values[index],
      set: (value) => (array.values[index] = convert(value, array.type)),
    }
  }

  /** A place that holds one value, as something to read and write (see resolveTarget). */
  function scalarTarget(place: Place, line: number) {
    if (place.kind === 'struct') throw isStructError(place.label, place.value.def, line)
    if (place.kind !== 'scalar') {
      throw new CodeError(line, 'codeError.assignArray', { name: place.label, example: `${place.label}[0] = 1;` })
    }
    const { label, type } = place
    return {
      label,
      changed: place.changed,
      type,
      read: (): Value => {
        const value = place.get()
        if (value === null) throw new CodeError(line, 'codeError.noValue', { name: label })
        return { type, value, work: formatNumber(value, type) }
      },
      write: place.set,
    }
  }

  /**
   * The struct an expression stands for, as it is now (not a copy): a struct variable, `students[i]`,
   * `s.born`, `*p`, or what a function like `make()` gives back. Null when it isn't a struct.
   */
  function structValueOf(expr: Expr): StructValue | null {
    if (expr.kind === 'call') {
      const result = callFunction(expr)
      return result && 'def' in result ? result : null
    }
    if (expr.kind === 'deref') {
      const pointee = follow(expr.name, expr.line)
      return pointee.slot.kind === 'struct' ? pointee.slot : null
    }
    if (expr.kind === 'var' || expr.kind === 'index' || expr.kind === 'member') {
      const place = placeOf(expr)
      return place.kind === 'struct' ? place.value : null
    }
    return null
  }

  /**
   * Copies every field of the struct `source` into `dest` (written `name` in the code), as `p2 = p1;` does
   * in C: afterwards the two are separate, so changing one doesn't change the other.
   */
  function copyStruct(name: string, dest: StructValue, source: Expr, line: number) {
    const from = structValueOf(source)
    if (!from) throw new CodeError(line, 'codeError.structAssign', { name, type: dest.def.name, field: dest.def.fields[0].name })
    if (from.def !== dest.def) {
      throw new CodeError(line, 'codeError.structTypeMismatch', { name, type: dest.def.name, value: toSource(source), valueType: from.def.name })
    }
    assignFields(dest, from)
  }

  /** How a whole-struct copy into `name` is explained: from another struct, or from what a function gave back. */
  function copyFact(name: string, value: StructValue, source: Expr, isDeclaration: boolean): StepFact {
    const values = fieldValues(value)
    if (source.kind === 'call') return { kind: 'structFromCall', name, type: value.def.name, call: toSource(source), values, isDeclaration }
    return { kind: 'copyStruct', name, type: value.def.name, source: toSource(source), values, isDeclaration }
  }

  /** `p2 = p1;`, `students[i] = s;`, `*p = q;`. Any other operator, like `p2 += p1` or `p2++`, would need a number. */
  function assignStruct(stmt: Extract<Stmt, { kind: 'assign' | 'update' }>, place: Extract<Place, { kind: 'struct' }>): Effect {
    if (stmt.kind === 'update' || stmt.op !== '=') throw isStructError(place.label, place.value.def, stmt.line)
    copyStruct(place.label, place.value, stmt.value, stmt.line)
    return { facts: [copyFact(place.label, place.value, stmt.value, false)], changed: [place.changed] }
  }

  /**
   * Fills a struct from a `{ ... }` list, field by field in order, as C does: a value for each plain
   * field, a `{ }` list or "text" for an array field, a `{ }` list or another struct for a struct field.
   * Everything left out is 0. Returns whether anything was left out.
   */
  function fillStruct(value: StructValue, items: Init[], label: string, line: number): boolean {
    const { def } = value
    if (items.length > def.fields.length) {
      throw new CodeError(line, 'codeError.tooManyFieldValues', { name: label, type: def.name, count: def.fields.length, given: items.length })
    }
    let zeroed = items.length < def.fields.length
    value.fields.forEach((field, i) => {
      const item = items[i]
      const name = `${label}.${field.name}`
      if (!item) {
        value.fields[i] = field.kind === 'struct' ? { ...field, value: newStruct(field.value.def, true) } : field.kind === 'scalar' ? { ...field, value: 0 } : field
        return
      }
      if (field.kind === 'scalar') {
        if (item.kind === 'list') throw new CodeError(item.line, 'codeError.notArrayInit', { name })
        if (item.kind === 'string') {
          throw new CodeError(item.line, field.type === 'char' ? 'codeError.stringIntoChar' : 'codeError.stringIntoNonChar', { name, type: field.type })
        }
        field.value = convert(evaluate(item.expr).value, field.type)
      } else if (field.kind === 'array') {
        const size = field.values.length
        if (item.kind === 'expr') throw new CodeError(item.line, 'codeError.arrayFieldInit', { name })
        field.values.fill(0)
        if (item.kind === 'string') {
          if (field.type !== 'char') throw new CodeError(item.line, 'codeError.stringIntoNonChar', { name, type: field.type })
          const codes = charCodes(item.text, item.line)
          if (codes.length + 1 > size) {
            throw new CodeError(item.line, 'codeError.stringTooLong', { text: quoteText(item.text), needed: codes.length + 1, count: codes.length, name, size })
          }
          codes.forEach((c, j) => (field.values[j] = c))
          return
        }
        if (item.items.length > size) throw new CodeError(item.line, 'codeError.tooManyValues', { name, size, given: item.items.length })
        item.items.forEach((element, j) => {
          if (element.kind !== 'expr') throw new CodeError(element.line, 'codeError.notArrayInit', { name: `${name}[${j}]` })
          field.values[j] = convert(evaluate(element.expr).value, field.type)
        })
        if (item.items.length < size) zeroed = true
      } else if (item.kind === 'list') {
        if (fillStruct(field.value, item.items, name, item.line)) zeroed = true
      } else if (item.kind === 'expr') {
        copyStruct(name, field.value, item.expr, item.line)
      } else {
        throw new CodeError(item.line, 'codeError.structAssign', { name, type: field.value.def.name, field: field.value.def.fields[0].name })
      }
    })
    return zeroed
  }

  /** `struct Point p;`, `= {1, 2}`, `= q`, `= make()`, or a pointer to a struct, or an array of structs. */
  function declareStruct(def: StructDef, d: StructDeclarator): Effect {
    const scope = frame().scopes[frame().scopes.length - 1]
    if (scope.has(d.name)) throw new CodeError(d.line, 'codeError.alreadyDeclared', { name: d.name })
    if (d.isPointer) return declareStructPointer(def, d, scope)
    if (d.isArray) return declareStructArray(def, d, scope)

    const slot: StructStore = { kind: 'struct', ...newStruct(def, false), address: newAddress() }
    const init = d.init
    let fact: StepFact
    if (init?.kind === 'list') {
      const zeroed = fillStruct(slot, init.items, d.name, d.line)
      fact = { kind: 'declareStructValues', name: d.name, type: def.name, values: fieldValues(slot), zeroed }
    } else if (init?.kind === 'expr') {
      copyStruct(d.name, slot, init.expr, d.line)
      fact = copyFact(d.name, slot, init.expr, true)
    } else if (init) {
      throw new CodeError(d.line, 'codeError.structAssign', { name: d.name, type: def.name, field: def.fields[0].name })
    } else {
      fact = { kind: 'declareStruct', name: d.name, type: def.name, fields: def.fields.map((field) => code(field.name)) }
    }

    scope.set(d.name, slot)
    return { facts: [fact], changed: [d.name] }
  }

  /** `struct Point *p;`, `struct Point *p = &a;` or `= NULL`: like an int pointer, but it points to a struct. */
  function declareStructPointer(def: StructDef, d: StructDeclarator, scope: Map<string, Slot>): Effect {
    const slot: PointerStore = { kind: 'pointer', type: def, target: null, address: newAddress() }
    const init = d.init
    if (init) {
      const notAddress = () => new CodeError(d.line, 'codeError.notAddress', { name: d.name, value: init.kind === 'expr' ? toSource(init.expr) : '{ ... }' })
      if (init.kind !== 'expr') throw notAddress()
      setPointer(d.name, slot, pointerValue(init.expr, notAddress), d.line)
    }
    scope.set(d.name, slot)
    const points = slot.target === null ? null : pointsTo(slot.target)
    return { facts: [{ kind: 'declarePointer', name: d.name, points }], changed: [d.name] }
  }

  /**
   * `struct Student students[3];` or `= {{...}, {...}}`, one `{ }` (or struct variable) per element. As for
   * any array with a `{ }`, elements and fields left out are 0; without one, the fields have no values yet.
   */
  function declareStructArray(def: StructDef, d: StructDeclarator, scope: Map<string, Slot>): Effect {
    const init = d.init
    if (init && init.kind !== 'list') throw new CodeError(d.line, 'codeError.structArrayInit', { name: d.name, type: def.name })
    const items = init?.items ?? []
    // `{1, 2, 3, 4}` leaves out the inner { }, which C allows but is hard to read; say so before counting.
    if (items.some((item) => item.kind === 'string' || (item.kind === 'expr' && item.expr.kind === 'number'))) {
      throw new CodeError(d.line, 'codeError.structArrayInit', { name: d.name, type: def.name })
    }
    const size = d.size ? evaluateSize(d.size, d) : items.length
    checkArraySize(size, d)
    if (items.length > size) throw new CodeError(d.line, 'codeError.tooManyValues', { name: d.name, size, given: items.length })

    const store: StructArrayStore = { kind: 'structArray', def, items: Array.from({ length: size }, () => newStruct(def, init !== null)) }
    let zeroed = items.length < size
    items.forEach((item, i) => {
      const label = `${d.name}[${i}]`
      if (item.kind === 'list') {
        if (fillStruct(store.items[i], item.items, label, item.line)) zeroed = true
        return
      }
      // `{a, b}` with struct variables copies them; `{1, 2, 3, 4}` without inner { } is left out (see AGENTS.md).
      const from = item.kind === 'expr' ? structValueOf(item.expr) : null
      if (!from || from.def !== def) throw new CodeError(item.line, 'codeError.structArrayInit', { name: d.name, type: def.name })
      assignFields(store.items[i], from)
    })

    scope.set(d.name, store)
    const values = init ? store.items.map((item, i) => code(`${d.name}[${i}] = ${formatStruct(item)}`)) : null
    return { facts: [{ kind: 'declareStructArray', name: d.name, type: def.name, size, values, zeroed }], changed: [d.name] }
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
      if (slot.kind !== 'scalar' && slot.kind !== 'struct') throw pointerError(expr.line, 'unsupported.pointerToArray')
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

  /**
   * Points the pointer `name` (of type `slot.type`) at `target`, checking the types match: an int * only
   * points to an int, a struct Point * only to a struct Point.
   */
  function setPointer(name: string, slot: PointerStore, target: PointerTarget | 'NULL', line: number) {
    if (target !== 'NULL' && pointeeType(target.slot) !== slot.type) {
      throw new CodeError(line, 'codeError.pointerTypeMismatch', {
        name,
        pointerType: typeText(slot.type),
        target: target.name,
        targetType: typeText(pointeeType(target.slot)),
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
    // `students[i]` is a whole struct; a number is needed here.
    if (store.kind === 'structArray') throw isStructError(toSource(expr), store.def, expr.line)
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
      if (slot.kind === 'struct') throw isStructError(target.name, slot.def, target.line)
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
      if (slot.kind === 'struct') throw isStructError(`*${target.name}`, slot.def, target.line)
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
    // A field: only it is highlighted, inside the struct's box ("p.x"), or its whole array of structs.
    if (target.kind === 'member') return scalarTarget(placeOf(target), target.line)
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

  function checkArraySize(size: number, d: Pick<Declarator, 'name' | 'line'>) {
    if (size > MAX_ARRAY_SIZE) {
      throw new CodeError(d.line, 'codeError.arrayTooBig', { name: d.name, max: MAX_ARRAY_SIZE })
    }
  }

  /**
   * A char array that holds text: one named on its own (`name`), or a char array field (`s.name`,
   * `students[i].name`). Null for anything else.
   */
  function textPlace(expr: Expr): { label: string; changed: string; store: ArrayStore } | null {
    if (expr.kind === 'var') {
      const slot = lookup(expr.name, expr.line)
      return slot.kind === 'array' && slot.type === 'char' ? { label: expr.name, changed: expr.name, store: slot } : null
    }
    if (expr.kind !== 'member') return null
    const place = placeOf(expr)
    return place.kind === 'array' && place.store.type === 'char' ? { label: place.label, changed: place.changed, store: place.store } : null
  }

  /** The text in a char array, up to its \0. Marks the whole array as used, so the array view shows it. */
  function textIn(place: { label: string; store: ArrayStore }, line: number): string {
    const text = textOf(place.store.values)
    if (text === null) throw new CodeError(line, 'codeError.noTerminator', { name: place.label })
    access = { name: place.label, store: place.store, active: null }
    return text
  }

  /** The text in a char array (see textPlace), for printf's %s, puts or a <string.h> function. */
  function readText(expr: Expr, line: number, notText: () => CodeError): string {
    const place = textPlace(expr)
    if (!place) throw notText()
    return textIn(place, line)
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
  function evaluateSize(expr: Expr, d: Pick<Declarator, 'name' | 'line'>): number {
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
        if (pointee.slot.kind === 'struct') throw isStructError(`*${expr.name}`, pointee.slot.def, expr.line)
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

      case 'member': {
        const place = placeOf(expr)
        if (place.kind === 'array' || place.kind === 'structArray') throw new CodeError(expr.line, 'codeError.isArray', { name: place.label })
        return scalarTarget(place, expr.line).read()
      }

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

      case 'sizeof':
        return evaluateSizeof(expr)

      case 'call': {
        const result = evaluateCall(expr)
        if (!result) {
          if (isTextWriter(expr.name)) throw stringResultError(expr.line, expr.name)
          throw new CodeError(expr.line, 'codeError.voidValue', { name: expr.name })
        }
        return result
      }

      // The parser only lets a "string" through where text is expected, which never needs its value.
      case 'string':
        throw stringError(expr.line)
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

    const t = stmt.target
    if (t.kind === 'var') {
      const slot = lookup(t.name, t.line)
      if (slot.kind === 'pointer') return assignPointer(stmt, t.name, slot)
      if (slot.kind === 'struct') return assignStruct(stmt, { kind: 'struct', label: t.name, changed: t.name, value: slot })
    }
    // `*p = q;` with p a pointer to a struct copies q into the struct p points to.
    if (t.kind === 'deref') {
      const pointee = follow(t.name, t.line)
      if (pointee.slot.kind === 'struct') {
        cellReads.push({ kind: 'derefWrite', pointer: t.name, target: pointee.name })
        return assignStruct(stmt, { kind: 'struct', label: `*${t.name}`, changed: pointeeKey(pointee), value: pointee.slot })
      }
    }

    // A field or an element of an array of structs is found once, since its indexes may call functions.
    let target: ReturnType<typeof resolveTarget>
    if (t.kind === 'member' || (t.kind === 'index' && lookup(t.name, t.line).kind === 'structArray')) {
      const place = placeOf(t)
      if (place.kind === 'struct') return assignStruct(stmt, place)
      target = scalarTarget(place, t.line)
    } else target = resolveTarget(t)
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

      case 'declareStruct': {
        const def = program.structs.get(stmt.structName)!
        for (const d of stmt.declarators) {
          const { facts, changed } = declareStruct(def, d)
          emit(d.line, facts[0], changed)
        }
        return null
      }

      case 'expr':
        // A call on its own line, like `greet();`, is shown through its call and return steps
        // (srand(), strcpy() and strcat() record their own step). A lone `rand();`, `toupper(c);` or
        // `strlen(s);` has neither, so it falls through and is shown as an expression.
        if (
          stmt.expr.kind === 'call' &&
          (program.functions.has(stmt.expr.name) ||
            (stmt.expr.name !== 'rand' && !isCtypeFunction(stmt.expr.name) && !givesStringValue(stmt.expr.name)))
        ) {
          callFunction(stmt.expr)
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
          if (placeholder === '%s' && (arg.kind === 'var' || arg.kind === 'member')) {
            return readText(arg, stmt.line, () =>
              stmt.isPuts
                ? new CodeError(stmt.line, 'codeError.putsText')
                : new CodeError(stmt.line, 'codeError.printfSNotText', { arg: toSource(arg) }),
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
            const place = scanText(targetExpr, text, stmt.line, fail)
            emit(stmt.line, { kind: 'scanText', name: place.label, text: quoteText(text), count: text.length }, [place.changed])
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

      case 'switch':
        return runSwitch(stmt)

      case 'break':
        emit(stmt.line, { kind: 'break', ofSwitch: stmt.ofSwitch })
        return { kind: 'break' }

      case 'continue': {
        const loop = frame().loops[frame().loops.length - 1]
        emit(stmt.line, { kind: 'continue', toUpdate: loop.hasUpdate, inSwitch: stmt.inSwitch })
        return { kind: 'continue' }
      }

      case 'return': {
        const fn = frame().fn
        if (stmt.value && fn.returnType === 'void') throw new CodeError(stmt.line, 'codeError.voidReturn', { name: fn.name })
        if (!stmt.value && fn.returnType !== 'void') {
          throw new CodeError(stmt.line, 'codeError.mustReturn', { name: fn.name, type: typeText(fn.returnType) })
        }

        if (!stmt.value || fn.returnType === 'void') {
          emit(stmt.line, { kind: 'return', name: fn.name, value: null, caller: callerName() })
          return { kind: 'return', value: null }
        }
        // `return p;` in a struct function gives the caller a copy of every field.
        if (typeof fn.returnType !== 'string') {
          const def = fn.returnType
          const from = structValueOf(stmt.value)
          if (!from || from.def !== def) {
            throw new CodeError(stmt.line, 'codeError.returnStruct', { name: fn.name, type: def.name, value: toSource(stmt.value) })
          }
          const result = copyStructValue(from)
          const source = toSource(stmt.value)
          emit(stmt.line, { kind: 'return', name: fn.name, value: { source, work: source, result: formatStruct(result) }, caller: callerName() })
          return { kind: 'return', value: result }
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
   * scanf("%s", name) or scanf("%s", s.name): stores one word from the Input field in the char array,
   * followed by the \0 that marks where the text ends. Returns how the array is written and named in `changed`.
   */
  function scanText(target: Target, text: string, line: number, fail: (key: TranslationKey, values: Phrase['values']) => CodeError) {
    const place = textPlace(target)
    if (!place) throw fail('codeError.scanfSNotText', { target: toSource(target) })
    const { label: name, store } = place
    const nonAscii = [...text].find((char) => char.length > 1 || char.charCodeAt(0) > 127)
    if (nonAscii) throw fail('codeError.nonAsciiChar', { char: nonAscii })
    const size = store.values.length
    if (text.length + 1 > size) {
      throw fail('codeError.scanfTooLong', { value: text, count: text.length, name, size, room: size - 1 })
    }
    charCodes(text, line).forEach((c, i) => (store.values[i] = c))
    store.values[text.length] = 0
    access = { name, store, active: null }
    return place
  }

  /**
   * Compares the value with the case labels once, then runs the body from the label that matched to the
   * end, or until a `break`: later labels are not checked, so code just carries on past them. Reaching one
   * that way is a fall-through, and it gets its own step. A `continue` or `return` is passed on up.
   */
  function runSwitch(stmt: Extract<Stmt, { kind: 'switch' }>): Jump | null {
    const value = evaluate(stmt.value)
    if (value.type === 'float') throw new CodeError(stmt.line, 'codeError.switchNotInt', { value: toSource(stmt.value) })
    const shown = formatNumber(value.value, value.type)
    const entry = stmt.labels.find((label) => label.value === value.value) ?? stmt.labels.find((label) => label.value === null)
    emit(stmt.line, { kind: 'switchCheck', value: { source: toSource(stmt.value), work: value.work, result: shown }, skipped: !entry })
    if (!entry) return null

    const labelsAt = (index: number) => stmt.labels.filter((label) => label.index === index)
    const names = (labels: SwitchLabel[]) => labels.map((label) => code(label.text))
    const current = frame()
    current.scopes.push(new Map())
    stmt.body.slice(0, entry.index).forEach(declareSkipped)
    emit(entry.line, { kind: 'switchEnter', label: entry.text, isDefault: entry.value === null, value: shown, stacked: names(labelsAt(entry.index)) })

    let jump: Jump | null = null
    for (let i = entry.index; i <= stmt.body.length && !jump; i++) {
      const reached = labelsAt(i)
      if (i > entry.index && reached.length > 0) emit(reached[0].line, { kind: 'fallThrough', labels: names(reached) })
      if (i < stmt.body.length) jump = run(stmt.body[i])
    }
    endScope(current.scopes.pop()!)
    return jump?.kind === 'break' ? null : jump
  }

  /**
   * C lets a switch jump past a declaration in its body: the variable exists from there on, but its
   * initial value was never set. An `int a[] = {1, 2};` gets its size from what was jumped past, so it stays out.
   */
  function declareSkipped(stmt: Stmt) {
    if (stmt.kind === 'declareStruct') {
      for (const d of stmt.declarators) {
        if (!d.isArray || d.size) declareStruct(program.structs.get(stmt.structName)!, { ...d, init: null })
      }
    }
    if (stmt.kind !== 'declare') return
    for (const d of stmt.declarators) {
      if (!d.isArray || d.size) declare(stmt.type, { ...d, init: null, arrayInit: null, gridInit: null, stringInit: null })
    }
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
