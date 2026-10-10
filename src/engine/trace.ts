import type { ArrayView, GridCell, GridView, LoopInfo, Step } from './types'

/** A variable's value while tracing. `null` means declared but not assigned yet. */
type Value = number | number[] | number[][] | null

type StepOptions = {
  /** Variables assigned on this line. They are highlighted as changed. */
  set?: Record<string, Value>
  /** Index (1D array) or { row, col } cell (2D array) this line reads or writes. */
  activeIndex?: number | GridCell
  /** A second index (1D array) this line uses, e.g. the other element of a swap. */
  secondIndex?: number
  loop?: LoopInfo
  /** Text printed by printf on this line. */
  print?: string
}

function isGrid(value: number[] | number[][]): value is number[][] {
  return Array.isArray(value[0])
}

function formatValue(value: Value): string {
  if (value === null) return '?'
  if (Array.isArray(value)) {
    if (isGrid(value)) return `[${value.map((row) => `[${row.join(', ')}]`).join(', ')}]`
    return `[${value.join(', ')}]`
  }
  return String(value)
}

/**
 * Records a program's execution one line at a time.
 * Call `step()` after "running" each line; it snapshots every variable and the
 * console output so far.
 */
export function createTrace(scope = 'main()') {
  const steps: Step[] = []
  const values = new Map<string, Value>()
  let output = ''

  function step(line: number, explanation: string, options: StepOptions = {}) {
    const { set = {}, activeIndex = null, secondIndex, loop = null, print = '' } = options

    for (const [name, value] of Object.entries(set)) {
      if (!Array.isArray(value)) values.set(name, value)
      else values.set(name, isGrid(value) ? value.map((row) => [...row]) : [...value])
    }
    output += print

    let array: ArrayView | GridView | null = null
    for (const [name, value] of values) {
      if (Array.isArray(value)) {
        if (isGrid(value)) {
          array = { name, values: value, activeIndex: typeof activeIndex === 'object' ? activeIndex : null }
        } else {
          array = { name, values: value, activeIndex: typeof activeIndex === 'number' ? activeIndex : null }
          if (secondIndex !== undefined) array.secondIndex = secondIndex
        }
        break
      }
    }

    steps.push({
      line,
      scope,
      variables: [...values].map(([name, value]) => ({ name, value: formatValue(value) })),
      changed: Object.keys(set),
      array,
      loop,
      output,
      explanation,
    })
  }

  return { step, steps }
}
