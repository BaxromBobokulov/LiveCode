import { createTrace } from '../../engine/trace'
import type { ExampleProgram, Step } from '../../engine/types'

const code = [
  '#include <stdio.h>',
  '',
  'int main() {',
  '    int arr[5] = {5, 1, 4, 2, 8};',
  '    int n = 5;',
  '    int i;',
  '    int j;',
  '    int temp;',
  '',
  '    for (i = 0; i < n - 1; i++) {',
  '        for (j = 0; j < n - 1 - i; j++) {',
  '            if (arr[j] > arr[j + 1]) {',
  '                temp = arr[j];',
  '                arr[j] = arr[j + 1];',
  '                arr[j + 1] = temp;',
  '            }',
  '        }',
  '    }',
  '',
  '    for (i = 0; i < n; i++) {',
  '        printf("%d ", arr[i]);',
  '    }',
  '    printf("\\n");',
  '    return 0;',
  '}',
]

// Mirrors the C program above, recording one step per executed line.
// Comparing and swapping use two neighbours at once, so those steps highlight
// both arr[j] and arr[j + 1].
function buildBubbleSortExample(): Step[] {
  const trace = createTrace()

  const arr = [5, 1, 4, 2, 8]
  const n = arr.length
  trace.step(4, 'Declare an integer array arr with 5 elements, in no particular order.', { set: { arr } })
  trace.step(5, `Create n and set it to ${n}, the number of elements.`, { set: { n } })
  trace.step(6, 'Declare the pass counter i. It has no value yet.', { set: { i: null } })
  trace.step(7, 'Declare the position counter j. It has no value yet.', { set: { j: null } })
  trace.step(8, 'Declare temp. It will hold a value during a swap. It has no value yet.', { set: { temp: null } })

  const passes = n - 1
  for (let i = 0; i < passes; i++) {
    const passLoop = { line: 10, iteration: i + 1, total: passes }
    trace.step(
      10,
      i === 0
        ? `Start the outer loop: set i to 0. 0 < ${passes} is true, so start pass 1.`
        : `Increase i to ${i}. ${i} < ${passes} is true, so start pass ${i + 1}.`,
      { set: { i }, loop: passLoop },
    )

    const limit = n - 1 - i
    for (let j = 0; j < limit; j++) {
      const pair = { activeIndex: j, secondIndex: j + 1 }
      const compareLoop = { line: 11, iteration: j + 1, total: limit }
      trace.step(
        11,
        j === 0
          ? `Start the inner loop: set j to 0. 0 < ${limit} is true, so compare arr[0] and arr[1].`
          : `Increase j to ${j}. ${j} < ${limit} is true, so compare arr[${j}] and arr[${j + 1}].`,
        { set: { j }, ...pair, loop: compareLoop },
      )

      const isBigger = arr[j] > arr[j + 1]
      trace.step(
        12,
        `Compare arr[${j}] (${arr[j]}) with arr[${j + 1}] (${arr[j + 1]}): ${arr[j]} > ${arr[j + 1]} is ${isBigger}, ${
          isBigger ? 'so swap them.' : 'so they stay where they are.'
        }`,
        { ...pair, loop: compareLoop },
      )

      if (isBigger) {
        const temp = arr[j]
        trace.step(13, `Swap, part 1: save arr[${j}] (${temp}) in temp so it isn't lost.`, {
          set: { temp },
          ...pair,
          loop: compareLoop,
        })

        arr[j] = arr[j + 1]
        trace.step(14, `Swap, part 2: copy arr[${j + 1}] (${arr[j]}) into arr[${j}].`, {
          set: { arr },
          ...pair,
          loop: compareLoop,
        })

        arr[j + 1] = temp
        trace.step(15, `Swap, part 3: put temp (${temp}) into arr[${j + 1}]. arr is now [${arr.join(', ')}].`, {
          set: { arr },
          ...pair,
          loop: compareLoop,
        })
      }
    }

    trace.step(
      11,
      `Increase j to ${limit}. ${limit} < ${limit} is false, so pass ${i + 1} is done: ${arr[limit]} is now in its final place.`,
      { set: { j: limit }, loop: passLoop },
    )
  }

  trace.step(10, `Increase i to ${passes}. ${passes} < ${passes} is false, so the array is sorted.`, {
    set: { i: passes },
  })

  for (let i = 0; i < n; i++) {
    const printLoop = { line: 20, iteration: i + 1, total: n }
    trace.step(
      20,
      i === 0
        ? `Start the print loop: set i to 0. 0 < ${n} is true, so run the loop body.`
        : `Increase i to ${i}. ${i} < ${n} is true, so run the loop body again.`,
      { set: { i }, activeIndex: i, loop: printLoop },
    )
    trace.step(21, `Print arr[${i}] (${arr[i]}) followed by a space.`, {
      print: `${arr[i]} `,
      activeIndex: i,
      loop: printLoop,
    })
  }

  trace.step(20, `Increase i to ${n}. ${n} < ${n} is false, so the loop ends.`, { set: { i: n } })
  trace.step(23, 'Print a line break to finish the output.', { print: '\n' })
  trace.step(24, 'Return 0 from main. The program finished successfully.')

  return trace.steps
}

export const bubbleSortExample: ExampleProgram = {
  id: 'bubbleSort',
  title: 'Bubble Sort',
  tag: 'Loops · Arrays',
  code,
  steps: buildBubbleSortExample(),
}
