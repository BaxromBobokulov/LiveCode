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
// Each explanation is a translation key from src/i18n/translations.ts plus the values it shows.
function buildSumExample(): Step[] {
  const trace = createTrace()

  const arr = [4, 8, 15, 16, 23]
  trace.step(4, { key: 'step.declareIntArray', values: { name: 'arr', size: 5 } }, { set: { arr } })

  let sum = 0
  trace.step(5, { key: 'step.createStartAt', values: { name: 'sum', value: 0 } }, { set: { sum } })
  trace.step(6, { key: 'step.declareCounter', values: { name: 'i' } }, { set: { i: null } })

  for (let i = 0; i < arr.length; i++) {
    const loop = { line: 8, iteration: i + 1, total: arr.length }
    trace.step(
      8,
      i === 0
        ? { key: 'step.loopStart', values: { name: 'i', value: 0, condition: '0 < 5' } }
        : { key: 'step.loopAgain', values: { name: 'i', value: i, condition: `${i} < 5` } },
      { set: { i }, activeIndex: i, loop },
    )

    sum = sum + arr[i]
    trace.step(9, { key: 'step.addTo', values: { element: `arr[${i}]`, value: arr[i], name: 'sum', result: sum } }, {
      set: { sum },
      activeIndex: i,
      loop,
    })
  }

  trace.step(8, { key: 'step.loopEnd', values: { name: 'i', value: 5, condition: '5 < 5' } }, { set: { i: arr.length } })
  trace.step(12, { key: 'step.printResult', values: { text: `Sum = ${sum}` } }, { print: `Sum = ${sum}\n` })
  trace.step(13, { key: 'explain.returnFromMain', values: { value: 0, name: 'main' } })

  return trace.steps
}

export const sumExample: ExampleProgram = {
  id: 'sum',
  title: 'Sum of Array Elements',
  tag: 'Arrays',
  code,
  steps: buildSumExample(),
}
