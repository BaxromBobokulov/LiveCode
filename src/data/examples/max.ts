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
  trace.step(4, { key: 'step.declareIntArray', values: { name: 'arr', size: 5 } }, { set: { arr } })

  let max = arr[0]
  trace.step(5, { key: 'step.max.assume', values: { value: max } }, {
    set: { max },
    activeIndex: 0,
  })
  trace.step(6, { key: 'step.declareCounter', values: { name: 'i' } }, { set: { i: null } })

  const total = arr.length - 1
  for (let i = 1; i < arr.length; i++) {
    const loop = { line: 8, iteration: i, total }
    trace.step(
      8,
      i === 1
        ? { key: 'step.max.loopStart' }
        : { key: 'step.max.loopAgain', values: { value: i, condition: `${i} < 5` } },
      { set: { i }, activeIndex: i, loop },
    )

    const isBigger = arr[i] > max
    trace.step(
      9,
      {
        key: 'step.max.compare',
        values: { index: i, value: arr[i], max, result: { key: isBigger ? 'explain.true' : 'explain.false' } },
      },
      { activeIndex: i, loop },
    )

    if (isBigger) {
      max = arr[i]
      trace.step(10, { key: 'step.max.found', values: { value: max } }, {
        set: { max },
        activeIndex: i,
        loop,
      })
    }
  }

  trace.step(8, { key: 'step.loopEnd', values: { name: 'i', value: 5, condition: '5 < 5' } }, { set: { i: arr.length } })
  trace.step(14, { key: 'step.printResult', values: { text: `Max = ${max}` } }, { print: `Max = ${max}\n` })
  trace.step(15, { key: 'explain.returnFromMain', values: { value: 0, name: 'main' } })

  return trace.steps
}

export const maxExample: ExampleProgram = {
  id: 'max',
  title: 'Find the Maximum',
  tag: 'Conditions',
  code,
  steps: buildMaxExample(),
}
