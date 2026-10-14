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
  /** For a pointer: the address of the variable it points to, so the panel can draw an arrow to that box. */
  pointsTo?: string
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

/** Tells a 2D array view apart from a 1D one. */
export function isGridView(view: ArrayView | GridView): view is GridView {
  return Array.isArray(view.values[0])
}

/**
 * How one character of a char array is written, without quotes: "A", or an escape for the
 * characters that can't be seen, e.g. "\0" for the 0 that marks the end of a string.
 */
export function charText(code: number): string {
  if (code === 0) return '\\0'
  if (code === 10) return '\\n'
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
  /** Names of the variables that changed on this step. */
  changed: string[]
  array: ArrayView | GridView | null
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
