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
  trace.step(4, { key: 'step.matrix.declare', values: { rows, cols } }, { set: { grid } })

  let sum = 0
  trace.step(5, { key: 'step.createStartAt', values: { name: 'sum', value: 0 } }, { set: { sum } })
  trace.step(6, { key: 'step.matrix.declareI' }, { set: { i: null } })
  trace.step(7, { key: 'step.matrix.declareJ' }, { set: { j: null } })

  for (let i = 0; i < rows; i++) {
    const rowLoop = { line: 9, iteration: i + 1, total: rows }
    trace.step(
      9,
      i === 0
        ? { key: 'step.matrix.rowStart', values: { condition: `0 < ${rows}` } }
        : { key: 'step.matrix.rowNext', values: { i, condition: `${i} < ${rows}` } },
      { set: { i }, loop: rowLoop },
    )

    for (let j = 0; j < cols; j++) {
      const colLoop = { line: 10, iteration: j + 1, total: cols }
      trace.step(
        10,
        j === 0
          ? { key: 'step.matrix.colStart', values: { i, condition: `0 < ${cols}` } }
          : { key: 'step.matrix.colNext', values: { i, j, condition: `${j} < ${cols}` } },
        { set: { j }, activeIndex: { row: i, col: j }, loop: colLoop },
      )

      sum = sum + grid[i][j]
      trace.step(11, { key: 'step.matrix.readAdd', values: { i, j, value: grid[i][j], sum } }, {
        set: { sum },
        activeIndex: { row: i, col: j },
        loop: colLoop,
      })
    }

    trace.step(10, { key: 'step.matrix.rowDone', values: { j: cols, condition: `${cols} < ${cols}`, i } }, {
      set: { j: cols },
      loop: rowLoop,
    })
  }

  trace.step(9, { key: 'step.matrix.outerEnd', values: { i: rows, condition: `${rows} < ${rows}` } }, { set: { i: rows } })
  trace.step(15, { key: 'step.printResult', values: { text: `Sum = ${sum}` } }, { print: `Sum = ${sum}\n` })
  trace.step(16, { key: 'explain.returnFromMain', values: { value: 0, name: 'main' } })

  return trace.steps
}

export const matrixExample: ExampleProgram = {
  id: 'matrix',
  title: 'Sum of a 3×3 Grid',
  tag: '2D Arrays',
  code,
  steps: buildMatrixExample(),
}
