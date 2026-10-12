import { createTrace } from '../../engine/trace'
import type { ExampleProgram, Step } from '../../engine/types'

const code = [
  '#include <stdio.h>',
  '',
  'int main() {',
  '    int n = 5;',
  '    int result = 1;',
  '    int i;',
  '',
  '    for (i = 1; i <= n; i++) {',
  '        result = result * i;',
  '    }',
  '',
  '    printf("%d! = %d\\n", n, result);',
  '    return 0;',
  '}',
]

// Mirrors the C program above, recording one step per executed line.
function buildFactorialExample(): Step[] {
  const trace = createTrace()

  const n = 5
  trace.step(4, { key: 'step.factorial.n', values: { n } }, { set: { n } })

  let result = 1
  trace.step(5, { key: 'step.factorial.result' }, {
    set: { result },
  })
  trace.step(6, { key: 'step.declareCounter', values: { name: 'i' } }, { set: { i: null } })

  for (let i = 1; i <= n; i++) {
    const loop = { line: 8, iteration: i, total: n }
    trace.step(
      8,
      i === 1
        ? { key: 'step.loopStart', values: { name: 'i', value: 1, condition: `1 <= ${n}` } }
        : { key: 'step.loopAgain', values: { name: 'i', value: i, condition: `${i} <= ${n}` } },
      { set: { i }, loop },
    )

    const previous = result
    result = result * i
    trace.step(9, { key: 'step.factorial.multiply', values: { previous, i, result } }, {
      set: { result },
      loop,
    })
  }

  trace.step(8, { key: 'step.loopEnd', values: { name: 'i', value: n + 1, condition: `${n + 1} <= ${n}` } }, {
    set: { i: n + 1 },
  })
  trace.step(12, { key: 'step.printResult', values: { text: `${n}! = ${result}` } }, { print: `${n}! = ${result}\n` })
  trace.step(13, { key: 'explain.returnFromMain', values: { value: 0, name: 'main' } })

  return trace.steps
}

export const factorialExample: ExampleProgram = {
  id: 'factorial',
  title: 'Factorial',
  tag: 'Loops',
  code,
  steps: buildFactorialExample(),
}
