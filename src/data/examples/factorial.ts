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
  trace.step(4, `Create n and set it to ${n}. We will compute ${n}!.`, { set: { n } })

  let result = 1
  trace.step(5, 'Create result and start it at 1, since multiplying by 1 changes nothing.', {
    set: { result },
  })
  trace.step(6, 'Declare the loop counter i. It has no value yet.', { set: { i: null } })

  for (let i = 1; i <= n; i++) {
    const loop = { line: 8, iteration: i, total: n }
    trace.step(
      8,
      i === 1
        ? `Start the loop: set i to 1. 1 <= ${n} is true, so run the loop body.`
        : `Increase i to ${i}. ${i} <= ${n} is true, so run the loop body again.`,
      { set: { i }, loop },
    )

    const previous = result
    result = result * i
    trace.step(9, `Multiply result by i: ${previous} × ${i} = ${result}.`, {
      set: { result },
      loop,
    })
  }

  trace.step(8, `Increase i to ${n + 1}. ${n + 1} <= ${n} is false, so the loop ends.`, {
    set: { i: n + 1 },
  })
  trace.step(12, `Print the result: ${n}! = ${result}.`, { print: `${n}! = ${result}\n` })
  trace.step(13, 'Return 0 from main. The program finished successfully.')

  return trace.steps
}

export const factorialExample: ExampleProgram = {
  id: 'factorial',
  title: 'Factorial',
  tag: 'Loops',
  code,
  steps: buildFactorialExample(),
}
