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
  trace.step(4, { key: 'step.bubbleSort.declareArray' }, { set: { arr } })
  trace.step(5, { key: 'step.bubbleSort.n', values: { n } }, { set: { n } })
  trace.step(6, { key: 'step.bubbleSort.declareI' }, { set: { i: null } })
  trace.step(7, { key: 'step.bubbleSort.declareJ' }, { set: { j: null } })
  trace.step(8, { key: 'step.bubbleSort.declareTemp' }, { set: { temp: null } })

  const passes = n - 1
  for (let i = 0; i < passes; i++) {
    const passLoop = { line: 10, iteration: i + 1, total: passes }
    trace.step(
      10,
      i === 0
        ? { key: 'step.bubbleSort.passStart', values: { condition: `0 < ${passes}` } }
        : { key: 'step.bubbleSort.passNext', values: { i, condition: `${i} < ${passes}`, pass: i + 1 } },
      { set: { i }, loop: passLoop },
    )

    const limit = n - 1 - i
    for (let j = 0; j < limit; j++) {
      const pair = { activeIndex: j, secondIndex: j + 1 }
      const compareLoop = { line: 11, iteration: j + 1, total: limit }
      trace.step(
        11,
        j === 0
          ? { key: 'step.bubbleSort.compareStart', values: { condition: `0 < ${limit}` } }
          : { key: 'step.bubbleSort.compareNext', values: { j, condition: `${j} < ${limit}`, next: j + 1 } },
        { set: { j }, ...pair, loop: compareLoop },
      )

      const isBigger = arr[j] > arr[j + 1]
      trace.step(
        12,
        {
          key: isBigger ? 'step.bubbleSort.compareSwap' : 'step.bubbleSort.compareKeep',
          values: { j, next: j + 1, a: arr[j], b: arr[j + 1] },
        },
        { ...pair, loop: compareLoop },
      )

      if (isBigger) {
        const temp = arr[j]
        trace.step(13, { key: 'step.bubbleSort.swap1', values: { j, value: temp } }, {
          set: { temp },
          ...pair,
          loop: compareLoop,
        })

        arr[j] = arr[j + 1]
        trace.step(14, { key: 'step.bubbleSort.swap2', values: { j, next: j + 1, value: arr[j] } }, {
          set: { arr },
          ...pair,
          loop: compareLoop,
        })

        arr[j + 1] = temp
        trace.step(15, { key: 'step.bubbleSort.swap3', values: { next: j + 1, value: temp, values: arr.join(', ') } }, {
          set: { arr },
          ...pair,
          loop: compareLoop,
        })
      }
    }

    trace.step(
      11,
      {
        key: 'step.bubbleSort.passDone',
        values: { j: limit, condition: `${limit} < ${limit}`, pass: i + 1, value: arr[limit] },
      },
      { set: { j: limit }, loop: passLoop },
    )
  }

  trace.step(10, { key: 'step.bubbleSort.sorted', values: { i: passes, condition: `${passes} < ${passes}` } }, {
    set: { i: passes },
  })

  for (let i = 0; i < n; i++) {
    const printLoop = { line: 20, iteration: i + 1, total: n }
    trace.step(
      20,
      i === 0
        ? { key: 'step.bubbleSort.printStart', values: { condition: `0 < ${n}` } }
        : { key: 'step.loopAgain', values: { name: 'i', value: i, condition: `${i} < ${n}` } },
      { set: { i }, activeIndex: i, loop: printLoop },
    )
    trace.step(21, { key: 'step.printWithSpace', values: { name: `arr[${i}]`, value: arr[i] } }, {
      print: `${arr[i]} `,
      activeIndex: i,
      loop: printLoop,
    })
  }

  trace.step(20, { key: 'step.loopEnd', values: { name: 'i', value: n, condition: `${n} < ${n}` } }, { set: { i: n } })
  trace.step(23, { key: 'step.printLineBreak' }, { print: '\n' })
  trace.step(24, { key: 'explain.returnFromMain', values: { value: 0, name: 'main' } })

  return trace.steps
}

export const bubbleSortExample: ExampleProgram = {
  id: 'bubbleSort',
  title: 'Bubble Sort',
  tag: 'Loops · Arrays',
  code,
  steps: buildBubbleSortExample(),
}
