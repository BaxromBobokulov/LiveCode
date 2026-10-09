import { createTrace } from '../../engine/trace'
import type { ExampleProgram, Step } from '../../engine/types'

const code = [
  '#include <stdio.h>',
  '',
  'int main() {',
  '    int arr[5] = {4, 8, 15, 16, 23};',
  '    int sum = 0;',
  '    int i;',
  '',
  '    for (i = 0; i < 5; i++) {',
  '        sum = sum + arr[i];',
  '    }',
  '',
  '    printf("Sum = %d\\n", sum);',
  '    return 0;',
  '}',
]

// Mirrors the C program above, recording one step per executed line.
function buildSumExample(): Step[] {
  const trace = createTrace()

  const arr = [4, 8, 15, 16, 23]
  trace.step(4, 'Declare an integer array arr with 5 elements.', { set: { arr } })

  let sum = 0
  trace.step(5, 'Create sum and start it at 0.', { set: { sum } })
  trace.step(6, 'Declare the loop counter i. It has no value yet.', { set: { i: null } })

  for (let i = 0; i < arr.length; i++) {
    const loop = { line: 8, iteration: i + 1, total: arr.length }
    trace.step(
      8,
      i === 0
        ? 'Start the loop: set i to 0. 0 < 5 is true, so run the loop body.'
        : `Increase i to ${i}. ${i} < 5 is true, so run the loop body again.`,
      { set: { i }, activeIndex: i, loop },
    )

    sum = sum + arr[i]
    trace.step(9, `Add arr[${i}] (${arr[i]}) to sum. sum is now ${sum}.`, {
      set: { sum },
      activeIndex: i,
      loop,
    })
  }

  trace.step(8, 'Increase i to 5. 5 < 5 is false, so the loop ends.', { set: { i: arr.length } })
  trace.step(12, `Print the result: Sum = ${sum}.`, { print: `Sum = ${sum}\n` })
  trace.step(13, 'Return 0 from main. The program finished successfully.')

  return trace.steps
}

export const sumExample: ExampleProgram = {
  id: 'sum',
  title: 'Sum of Array Elements',
  tag: 'Arrays',
  code,
  steps: buildSumExample(),
}
