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
  trace.step(4, 'Create a and set it to 0. a always holds the current Fibonacci number.', { set: { a } })
  let b = 1
  trace.step(5, 'Create b and set it to 1. b always holds the number after a.', { set: { b } })
  trace.step(6, 'Declare next. It will hold a + b. It has no value yet.', { set: { next: null } })
  trace.step(7, 'Declare the loop counter i. It has no value yet.', { set: { i: null } })

  for (let i = 0; i < count; i++) {
    const loop = { line: 9, iteration: i + 1, total: count }
    trace.step(
      9,
      i === 0
        ? `Start the loop: set i to 0. 0 < ${count} is true, so run the loop body.`
        : `Increase i to ${i}. ${i} < ${count} is true, so run the loop body again.`,
      { set: { i }, loop },
    )

    trace.step(10, `Print a (${a}) followed by a space.`, { print: `${a} `, loop })

    const next = a + b
    trace.step(11, `Add the two numbers: next = a + b = ${a} + ${b} = ${next}.`, { set: { next }, loop })

    a = b
    trace.step(12, `Move forward one place: a takes b's value, ${a}.`, { set: { a }, loop })

    b = next
    trace.step(13, `b takes next's value, ${b}. The next two numbers are now ${a} and ${b}.`, { set: { b }, loop })
  }

  trace.step(9, `Increase i to ${count}. ${count} < ${count} is false, so the loop ends.`, { set: { i: count } })
  trace.step(16, 'Print a line break to finish the output.', { print: '\n' })
  trace.step(17, 'Return 0 from main. The program finished successfully.')

  return trace.steps
}

export const fibonacciExample: ExampleProgram = {
  id: 'fibonacci',
  title: 'Fibonacci Sequence',
  tag: 'Loops',
  code,
  steps: buildFibonacciExample(),
}
