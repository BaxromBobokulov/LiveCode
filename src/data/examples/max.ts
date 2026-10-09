import { createTrace } from '../../engine/trace'
import type { ExampleProgram, Step } from '../../engine/types'

const code = [
  '#include <stdio.h>',
  '',
  'int main() {',
  '    int arr[5] = {7, 2, 19, 4, 11};',
  '    int max = arr[0];',
  '    int i;',
  '',
  '    for (i = 1; i < 5; i++) {',
  '        if (arr[i] > max) {',
  '            max = arr[i];',
  '        }',
  '    }',
  '',
  '    printf("Max = %d\\n", max);',
  '    return 0;',
  '}',
]

// Mirrors the C program above, recording one step per executed line.
function buildMaxExample(): Step[] {
  const trace = createTrace()

  const arr = [7, 2, 19, 4, 11]
  trace.step(4, 'Declare an integer array arr with 5 elements.', { set: { arr } })

  let max = arr[0]
  trace.step(5, `Assume the first element is the largest: max = arr[0] = ${max}.`, {
    set: { max },
    activeIndex: 0,
  })
  trace.step(6, 'Declare the loop counter i. It has no value yet.', { set: { i: null } })

  const total = arr.length - 1
  for (let i = 1; i < arr.length; i++) {
    const loop = { line: 8, iteration: i, total }
    trace.step(
      8,
      i === 1
        ? 'Start the loop at i = 1, since arr[0] is already in max. 1 < 5 is true.'
        : `Increase i to ${i}. ${i} < 5 is true, so check the next element.`,
      { set: { i }, activeIndex: i, loop },
    )

    const isBigger = arr[i] > max
    trace.step(
      9,
      `Compare arr[${i}] (${arr[i]}) with max (${max}): ${arr[i]} > ${max} is ${isBigger}.`,
      { activeIndex: i, loop },
    )

    if (isBigger) {
      max = arr[i]
      trace.step(10, `Found a bigger value. max is now ${max}.`, {
        set: { max },
        activeIndex: i,
        loop,
      })
    }
  }

  trace.step(8, 'Increase i to 5. 5 < 5 is false, so the loop ends.', { set: { i: arr.length } })
  trace.step(14, `Print the result: Max = ${max}.`, { print: `Max = ${max}\n` })
  trace.step(15, 'Return 0 from main. The program finished successfully.')

  return trace.steps
}

export const maxExample: ExampleProgram = {
  id: 'max',
  title: 'Find the Maximum',
  tag: 'Conditions',
  code,
  steps: buildMaxExample(),
}
