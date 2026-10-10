import { createTrace } from '../../engine/trace'
import type { ExampleProgram, Step } from '../../engine/types'

const code = [
  '#include <stdio.h>',
  '',
  'int main() {',
  '    int grid[3][3] = {{1, 2, 3}, {4, 5, 6}, {7, 8, 9}};',
  '    int sum = 0;',
  '    int i;',
  '    int j;',
  '',
  '    for (i = 0; i < 3; i++) {',
  '        for (j = 0; j < 3; j++) {',
  '            sum = sum + grid[i][j];',
  '        }',
  '    }',
  '',
  '    printf("Sum = %d\\n", sum);',
  '    return 0;',
  '}',
]

// Mirrors the C program above, recording one step per executed line.
function buildMatrixExample(): Step[] {
  const trace = createTrace()

  const grid = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9],
  ]
  const rows = grid.length
  const cols = grid[0].length
  trace.step(4, 'Declare a 2D integer array grid with 3 rows and 3 columns.', { set: { grid } })

  let sum = 0
  trace.step(5, 'Create sum and start it at 0.', { set: { sum } })
  trace.step(6, 'Declare the row counter i. It has no value yet.', { set: { i: null } })
  trace.step(7, 'Declare the column counter j. It has no value yet.', { set: { j: null } })

  for (let i = 0; i < rows; i++) {
    const rowLoop = { line: 9, iteration: i + 1, total: rows }
    trace.step(
      9,
      i === 0
        ? 'Start the outer loop: set i to 0. 0 < 3 is true, so walk through row 0.'
        : `Increase i to ${i}. ${i} < 3 is true, so walk through row ${i}.`,
      { set: { i }, loop: rowLoop },
    )

    for (let j = 0; j < cols; j++) {
      const colLoop = { line: 10, iteration: j + 1, total: cols }
      trace.step(
        10,
        j === 0
          ? `Start the inner loop: set j to 0. 0 < 3 is true, so visit grid[${i}][0].`
          : `Increase j to ${j}. ${j} < 3 is true, so visit grid[${i}][${j}].`,
        { set: { j }, activeIndex: { row: i, col: j }, loop: colLoop },
      )

      sum = sum + grid[i][j]
      trace.step(11, `Read grid[${i}][${j}] (value ${grid[i][j]}) and add it to sum. sum is now ${sum}.`, {
        set: { sum },
        activeIndex: { row: i, col: j },
        loop: colLoop,
      })
    }

    trace.step(10, `Increase j to 3. 3 < 3 is false, so row ${i} is done.`, { set: { j: cols }, loop: rowLoop })
  }

  trace.step(9, 'Increase i to 3. 3 < 3 is false, so the outer loop ends.', { set: { i: rows } })
  trace.step(15, `Print the result: Sum = ${sum}.`, { print: `Sum = ${sum}\n` })
  trace.step(16, 'Return 0 from main. The program finished successfully.')

  return trace.steps
}

export const matrixExample: ExampleProgram = {
  id: 'matrix',
  title: 'Sum of a 3×3 Grid',
  tag: '2D Arrays',
  code,
  steps: buildMatrixExample(),
}
