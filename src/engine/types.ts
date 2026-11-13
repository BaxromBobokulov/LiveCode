// The contract between src/data/examples/ and every visualization component.
// Changing the shape of Step means updating every example file in the same change.
import type { TranslationKey } from '../i18n/translations'

/**
 * Text that the UI shows in the chosen language: a translation key plus the values for its
 * "{name}" placeholders, e.g. { key: 'explain.assign', values: { target: 'sum', value: '4' } }.
 * A value can itself be a Phrase, or a list of Phrases (shown as "a, b and c").
 */
export type Phrase = { key: TranslationKey; values?: Record<string, PhraseValue> }
export type PhraseValue = string | number | Phrase | Phrase[]

/** One variable as the Variables panel shows it. */
export type Variable = {
  name: string
  /** Display-ready value, e.g. "15", "[4, 8, 15]" or "?" when not yet assigned. A pointer's value is an address ("0x104") or "NULL". */
  value: string
  /** Made-up address of the variable, e.g. "0x104". Only set in programs that use pointers. */
  address?: string
  /** Marks a pointer, e.g. `int *p`. Its value is the address it holds, "NULL", or "?" before it gets one. */
  isPointer?: true
  /**
   * Set on the box of another function's variable, e.g. "main()": while a function runs, a variable of
   * its caller that one of its pointers points to is shown too (as "x · main()"), so the arrow has a box
   * to point at. Such boxes are only in the steps of that call.
   */
  scope?: string
  /** For a pointer: the address of the variable it points to, so the panel can draw an arrow to that box. */
  pointsTo?: string
  /**
   * For a struct variable, e.g. `struct Point p`: the struct's name, "Point". Its fields are in `fields`.
   * Also set on an array of structs (`struct Point pts[3]`), together with `length`.
   */
  structType?: string
  /** A struct variable's fields in the order they are declared, each with a display-ready value ("?" before it has one). */
  fields?: FieldView[]
  /** For an array of structs: how many elements it has. Its elements are drawn in the array view. */
  length?: number
}

/**
 * One field of a struct as the panel shows it. `value` is display-ready: "3", "?", "[90, 85, 77]" for an
 * array field, "\"Ali\"" for a char array field. A struct field also has its own `fields`.
 */
export type FieldView = { name: string; value: string; fields?: FieldView[] }

/**
 * How a variable is told apart in `Step.changed` and in the Variables panel: its name, or "x@main()"
 * for another function's variable (see Variable.scope), which may have the same name as one here.
 */
export function variableKey(variable: Pick<Variable, 'name' | 'scope'>): string {
  return variable.scope ? `${variable.name}@${variable.scope}` : variable.name
}

/**
 * How `Step.changed` names one field of a struct variable when only that field changed, e.g. "p.x", or
 * "p.born.day" for a field of a struct field (pass "born.day"). When the whole struct changed (declared,
 * or copied with `p2 = p1;`) `changed` names just the variable. A write to one element of an array field
 * names the field ("s.marks"), and a write into an array of structs names the array ("students"), the
 * same way `arr[i] = 1;` names `arr`.
 */
export function fieldKey(variable: Pick<Variable, 'name' | 'scope'>, field: string): string {
  return `${variableKey(variable)}.${field}`
}

/** The array drawn in the array visualization. */
export type ArrayView = {
  name: string
  values: number[]
  /** Index the current line reads or writes, or null when no element is in use. */
  activeIndex: number | null
  /** A second element in use on this line, e.g. the other half of a swap. Highlighted like activeIndex. */
  secondIndex?: number
  /** A char array: `values` are character codes, drawn as characters (see charText). */
  chars?: true
}

/** One cell of a 2D array: grid[row][col]. */
export type GridCell = { row: number; col: number }

/** A 2D array, e.g. `int grid[3][3]`, drawn as rows × columns. */
export type GridView = {
  name: string
  /** One inner array per row. */
  values: number[][]
  /** Cell the current line reads or writes, or null when no cell is in use. */
  activeIndex: GridCell | null
  /** A 2D char array: `values` are character codes, drawn as characters (see charText). */
  chars?: true
}

/**
 * An array of structs, e.g. `struct Student students[3]`, drawn as a row of elements, each one a small
 * box of its fields (like a struct's box in the Variables panel).
 */
export type StructArrayView = {
  kind: 'structs'
  name: string
  /** The struct's name, "Student". */
  structType: string
  /** One entry per element: its fields in order, each display-ready (see FieldView). */
  items: FieldView[][]
  /** Element the current line reads or writes, or null when no element is in use. */
  activeIndex: number | null
  /** The field of the active element the line uses, e.g. "gpa". Not set when it uses the whole element. */
  activeField?: string
}

/** What the array view can draw: a 1D array, a 2D array or an array of structs. */
export type AnyArrayView = ArrayView | GridView | StructArrayView

/** Tells an array of structs apart from the number arrays. */
export function isStructArrayView(view: AnyArrayView): view is StructArrayView {
  return 'kind' in view && view.kind === 'structs'
}

/** Tells a 2D array view apart from a 1D one (or an array of structs). */
export function isGridView(view: AnyArrayView): view is GridView {
  return !isStructArrayView(view) && Array.isArray(view.values[0])
}

/**
 * How one character of a char array is written, without quotes: "A", or an escape for the
 * characters that can't be seen, e.g. "\0" for the 0 that marks the end of a string.
 */
export function charText(code: number): string {
  if (code === 0) return '\\0'
  if (code === 9) return '\\t'
  if (code === 10) return '\\n'
  if (code === 13) return '\\r'
  if (code === 39) return "\\'"
  if (code === 92) return '\\\\'
  if (code >= 32 && code <= 126) return String.fromCharCode(code)
  return String(code)
}

/** Progress through the loop the current line belongs to. */
export type LoopInfo = {
  /** 1-based line number of the loop header, e.g. the `for (...)` line. */
  line: number
  /** 1-based iteration currently running. */
  iteration: number
  total: number
}

/** A snapshot of the program right after one line has run. */
export type Step = {
  /** 1-based line number highlighted in the editor. */
  line: number
  /** Function currently executing, e.g. "main()". */
  scope: string
  variables: Variable[]
  /** Names of the variables that changed on this step (see variableKey for another function's variable). */
  changed: string[]
  array: AnyArrayView | null
  loop: LoopInfo | null
  /** Everything printed to the console so far. */
  output: string
  /** Plain-language description of what this line did, one Phrase per sentence. */
  explanation: Phrase[]
}

export type ExampleProgram = {
  id: string
  title: string
  /** Short topic label, e.g. "Arrays" or "Loops". */
  tag: string
  /** Source code, one entry per line. */
  code: string[]
  steps: Step[]
}
