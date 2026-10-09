import type { ArrayView, LoopInfo, Step } from './types'

/** A variable's value while tracing. `null` means declared but not assigned yet. */
type Value = number | number[] | null

type StepOptions = {
  /** Variables assigned on this line. They are highlighted as changed. */
  set?: Record<string, Value>
  /** Index of the array element this line reads or writes. */
  activeIndex?: number
  loop?: LoopInfo
  /** Text printed by printf on this line. */
  print?: string
}

function formatValue(value: Value): string {
  if (value === null) return '?'
  if (Array.isArray(value)) return `[${value.join(', ')}]`
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
    const { set = {}, activeIndex = null, loop = null, print = '' } = options

    for (const [name, value] of Object.entries(set)) {
      values.set(name, Array.isArray(value) ? [...value] : value)
    }
    output += print

    let array: ArrayView | null = null
    for (const [name, value] of values) {
      if (Array.isArray(value)) {
        array = { name, values: value, activeIndex }
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
