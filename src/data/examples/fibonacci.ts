import { createTrace } from '../../engine/trace'
import type { ExampleProgram, Step } from '../../engine/types'

const code = [
  '#include <stdio.h>',
  '',
  'int main() {',
  '    int a = 0;',
  '    int b = 1;',
  '    int next;',
  '    int i;',
  '',
  '    for (i = 0; i < 10; i++) {',
  '        printf("%d ", a);',
  '        next = a + b;',
  '        a = b;',
  '        b = next;',
  '    }',
  '',
  '    printf("\\n");',
  '    return 0;',
  '}',
]

// Mirrors the C program above, recording one step per executed line.
function buildFibonacciExample(): Step[] {
  const trace = createTrace()
  const count = 10

  let a = 0
  trace.step(4, { key: 'step.fibonacci.a' }, { set: { a } })
  let b = 1
  trace.step(5, { key: 'step.fibonacci.b' }, { set: { b } })
  trace.step(6, { key: 'step.fibonacci.next' }, { set: { next: null } })
  trace.step(7, { key: 'step.declareCounter', values: { name: 'i' } }, { set: { i: null } })

  for (let i = 0; i < count; i++) {
    const loop = { line: 9, iteration: i + 1, total: count }
    trace.step(
      9,
      i === 0
        ? { key: 'step.loopStart', values: { name: 'i', value: 0, condition: `0 < ${count}` } }
        : { key: 'step.loopAgain', values: { name: 'i', value: i, condition: `${i} < ${count}` } },
      { set: { i }, loop },
    )

    trace.step(10, { key: 'step.printWithSpace', values: { name: 'a', value: a } }, { print: `${a} `, loop })

    const next = a + b
    trace.step(11, { key: 'step.fibonacci.add', values: { a, b, next } }, { set: { next }, loop })

    a = b
    trace.step(12, { key: 'step.fibonacci.moveA', values: { a } }, { set: { a }, loop })

    b = next
    trace.step(13, { key: 'step.fibonacci.moveB', values: { a, b } }, { set: { b }, loop })
  }

  trace.step(9, { key: 'step.loopEnd', values: { name: 'i', value: count, condition: `${count} < ${count}` } }, {
    set: { i: count },
  })
  trace.step(16, { key: 'step.printLineBreak' }, { print: '\n' })
  trace.step(17, { key: 'explain.returnFromMain', values: { value: 0, name: 'main' } })

  return trace.steps
}

export const fibonacciExample: ExampleProgram = {
  id: 'fibonacci',
  title: 'Fibonacci Sequence',
  tag: 'Loops',
  code,
  steps: buildFibonacciExample(),
}
