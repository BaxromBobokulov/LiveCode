// The contract between src/data/examples/ and every visualization component.
// Changing the shape of Step means updating every example file in the same change.

/** One variable as the Variables panel shows it. */
export type Variable = {
  name: string
  /** Display-ready value, e.g. "15", "[4, 8, 15]" or "?" when not yet assigned. */
  value: string
}

/** The array drawn in the array visualization. */
export type ArrayView = {
  name: string
  values: number[]
  /** Index the current line reads or writes, or null when no element is in use. */
  activeIndex: number | null
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
  array: ArrayView | null
  loop: LoopInfo | null
  /** Everything printed to the console so far. */
  output: string
  /** Plain-language description of what this line did. */
  explanation: string
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
