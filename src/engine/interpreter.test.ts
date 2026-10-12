import { describe, expect, it } from 'vitest'
import { examples } from '../data/examples'
import { translations } from '../i18n/translations'
import { formatPhrase } from '../i18n/formatPhrase'
import { CodeError, UnsupportedConstructError } from './errors'
import { runUserCode } from './interpreter'
import type { Step } from './types'

function stepsOf(source: string): Step[] {
  const result = runUserCode(source)
  if ('error' in result) throw new Error(`Unexpected error on line ${result.error.line}: ${result.error.message}`)
  return result.steps
}

const lines = (...code: string[]) => code.join('\n')

/** A step's explanation as the Playground shows it in English. */
const english = (step: Step) => step.explanation.map((p) => formatPhrase(translations.en, p)).join(' ')

describe('runUserCode', () => {
  it('traces a simple assignment program', () => {
    const steps = stepsOf(
      lines(
        '#include <stdio.h>',
        'int main() {',
        '    int a = 2;',
        '    int b;',
        '    b = a * 3;',
        '    printf("b = %d\\n", b);',
        '    return 0;',
        '}',
      ),
    )

    expect(steps.map((s) => s.line)).toEqual([3, 4, 5, 6, 7])
    expect(steps[0]).toMatchObject({ scope: 'main()', changed: ['a'], variables: [{ name: 'a', value: '2' }] })
    expect(english(steps[0])).toBe('Create a and set it to 2.')
    expect(steps[1].variables).toContainEqual({ name: 'b', value: '?' })
    expect(english(steps[2])).toBe('Set b to a * 3: 2 * 3 = 6.')
    expect(steps[2].changed).toEqual(['b'])
    expect(steps[3].output).toBe('b = 6\n')
    expect(english(steps[4])).toBe('Return 0 from main. The program finished successfully.')
  })

  it('traces a for loop over an array', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    int arr[3] = {4, 8, 15};',
        '    int sum = 0;',
        '    for (int i = 0; i < 3; i++) {',
        '        sum = sum + arr[i];',
        '    }',
        '    printf("%d\\n", sum);',
        '    return 0;',
        '}',
      ),
    )

    const checks = steps.filter((s) => s.line === 4)
    expect(checks).toHaveLength(4)
    expect(english(checks[0])).toBe('Start the loop: create i and set it to 0. Check i < 3: 0 < 3 is true, so run the loop body.')
    expect(english(checks[1])).toBe('Increase i to 1. Check i < 3: 1 < 3 is true, so run the loop body again.')
    expect(english(checks[3])).toBe('Increase i to 3. Check i < 3: 3 < 3 is false, so the loop ends.')
    expect(checks[3].loop).toBeNull()

    const bodySteps = steps.filter((s) => s.line === 5)
    expect(bodySteps.map((s) => s.loop)).toEqual([
      { line: 4, iteration: 1, total: 3 },
      { line: 4, iteration: 2, total: 3 },
      { line: 4, iteration: 3, total: 3 },
    ])
    expect(bodySteps[1].array).toEqual({ name: 'arr', values: [4, 8, 15], activeIndex: 1 })
    expect(english(bodySteps[1])).toBe('Set sum to sum + arr[i]: 4 + 8 = 12.')
    expect(steps.at(-2)?.output).toBe('27\n')
  })

  it('takes the matching if / else branch', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    int x = 3;',
        '    if (x > 5) {',
        '        printf("big\\n");',
        '    } else if (x > 1) {',
        '        printf("medium\\n");',
        '    } else {',
        '        printf("small\\n");',
        '    }',
        '    return 0;',
        '}',
      ),
    )

    expect(steps.map((s) => s.line)).toEqual([2, 3, 5, 6, 10])
    expect(english(steps[1])).toBe('Check if x > 5: 3 > 5 is false, so check the next condition.')
    expect(english(steps[2])).toBe('Check else if x > 1: 3 > 1 is true, so run this else if block.')
    expect(steps.at(-1)?.output).toBe('medium\n')
  })

  it('steps into a function call and back', () => {
    const steps = stepsOf(
      lines(
        'int add(int a, int b) {',
        '    return a + b;',
        '}',
        '',
        'int main() {',
        '    int s = add(2, 3);',
        '    printf("%d\\n", s);',
        '    return 0;',
        '}',
      ),
    )

    expect(steps.map((s) => [s.line, s.scope])).toEqual([
      [1, 'add()'],
      [2, 'add()'],
      [6, 'main()'],
      [7, 'main()'],
      [8, 'main()'],
    ])
    expect(english(steps[0])).toBe('Call add(2, 3). Inside add, a = 2 and b = 3.')
    expect(steps[0].variables).toEqual([
      { name: 'a', value: '2' },
      { name: 'b', value: '3' },
    ])
    expect(english(steps[1])).toBe('Leave add and go back to main, returning a + b: 2 + 3 = 5.')
    expect(english(steps[2])).toBe('Create s and set it to add(2, 3) (5).')
    expect(steps[3].output).toBe('5\n')
  })

  it('traces reads and writes on a 2D array', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    int grid[2][3] = {{1, 2, 3}, {4, 5, 6}};',
        '    int x = grid[1][2];',
        '    grid[0][0] = grid[0][0] + 4;',
        '    grid[1][0]++;',
        '    return 0;',
        '}',
      ),
    )

    expect(english(steps[0])).toBe('Declare an int 2D array grid with 2 rows and 3 columns: [[1, 2, 3], [4, 5, 6]].')
    expect(steps[0].variables).toEqual([{ name: 'grid', value: '[[1, 2, 3], [4, 5, 6]]' }])
    expect(steps[0].array).toEqual({ name: 'grid', values: [[1, 2, 3], [4, 5, 6]], activeIndex: null })

    expect(english(steps[1])).toBe('Read grid[1][2] (value 6). Create x and set it to grid[1][2] (6).')
    expect(steps[1].array?.activeIndex).toEqual({ row: 1, col: 2 })

    expect(english(steps[2])).toBe('Read grid[0][0] (value 1). Set grid[0][0] to grid[0][0] + 4: 1 + 4 = 5.')
    expect(steps[2].changed).toEqual(['grid'])
    expect(steps[2].array).toEqual({ name: 'grid', values: [[5, 2, 3], [4, 5, 6]], activeIndex: { row: 0, col: 0 } })

    expect(english(steps[3])).toBe('Increase grid[1][0] by 1. grid[1][0] is now 5.')
    expect(steps[3].array?.activeIndex).toEqual({ row: 1, col: 0 })
  })

  it('passes a 2D array to a function by reference', () => {
    const steps = stepsOf(
      lines(
        'void fill(int g[][2]) {',
        '    g[1][1] = 9;',
        '}',
        'int main() {',
        '    int grid[2][2];',
        '    fill(grid);',
        '    printf("%d\\n", grid[1][1]);',
        '    return 0;',
        '}',
      ),
    )
    expect(steps.at(-1)?.output).toBe('9\n')
  })

  it('reports an out-of-range 2D index as a code error', () => {
    const result = runUserCode(lines('int main() {', '    int g[2][2] = {{1, 2}, {3, 4}};', '    g[0][2] = 1;', '    return 0;', '}'))
    expect('error' in result && result.error).toBeInstanceOf(CodeError)
    expect('error' in result && result.error.text).toEqual({
      key: 'codeError.colOutside',
      values: { name: 'g', row: 0, col: 2, cols: 2, last: 1 },
    })
  })

  it('reports a 3D array as not supported', () => {
    const result = runUserCode(lines('int main() {', '    int cube[2][2][2];', '    return 0;', '}'))
    expect('error' in result && result.error).toBeInstanceOf(UnsupportedConstructError)
    expect('error' in result && result.error).toMatchObject({ line: 2, construct: { key: 'construct.array3d' } })
  })

  it.each(examples.map((example) => [example.id, example] as const))(
    'agrees with the hand-authored %s example',
    (_, example) => {
      const steps = stepsOf(example.code.join('\n'))
      expect(steps.map((s) => s.line)).toEqual(example.steps.map((s) => s.line))
      expect(steps.at(-1)?.output).toBe(example.steps.at(-1)?.output)

      // Bubble sort highlights both cells of a compare or swap, which only the hand-authored trace does.
      if (example.steps.some((s) => s.array && 'secondIndex' in s.array)) return
      expect(steps.map((s) => s.array?.activeIndex ?? null)).toEqual(example.steps.map((s) => s.array?.activeIndex ?? null))
    },
  )

  it('explains the hand-authored examples in every language', () => {
    expect(english(examples[0].steps[3])).toBe('Start the loop: set i to 0. 0 < 5 is true, so run the loop body.')
    expect(english(examples[0].steps[4])).toBe('Add arr[0] (4) to sum. sum is now 4.')

    const userCode = lines(
      'int add(int a, int b) {',
      '    return a + b;',
      '}',
      'int main() {',
      '    float g[1][2] = {{1, 2}};',
      '    int s = 0;',
      '    for (int i = 0; i < 2; i++) {',
      '        if (i > 0) { s = add(s, i); } else if (i < 0) { s--; } else { s++; }',
      '    }',
      '    printf("%d\\n", s);',
      '    return 0;',
      '}',
    )
    const allSteps = [...examples.flatMap((e) => e.steps), ...stepsOf(userCode)]
    for (const strings of Object.values(translations)) {
      for (const step of allSteps) {
        for (const phrase of step.explanation) {
          // Every placeholder got a value: nothing left like "{name}" or "undefined".
          expect(formatPhrase(strings, phrase)).not.toMatch(/\{\w+\}|undefined/)
        }
      }
    }
  })

  it('highlights the element a loop body is about to use on the loop check', () => {
    const steps = stepsOf(
      lines(
        'int main() {',
        '    int arr[3] = {4, 8, 15};',
        '    int i = 0;',
        '    while (i < 3) {',
        '        arr[i] = arr[i] * 2;',
        '        i++;',
        '    }',
        '    return 0;',
        '}',
      ),
    )

    const checks = steps.filter((s) => s.line === 4)
    expect(checks.map((s) => s.array?.activeIndex)).toEqual([0, 1, 2, null])
    // The check shows the array as it was before the body changed it.
    expect(checks[1].array?.values).toEqual([8, 8, 15])
  })

  it('reports a pointer as not supported, with its line', () => {
    const result = runUserCode(lines('int main() {', '    int x = 1;', '    int *p = &x;', '    return 0;', '}'))

    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toBeInstanceOf(UnsupportedConstructError)
    expect(result.error).toMatchObject({ line: 3, construct: { key: 'construct.pointer' } })
  })

  it('reports mistakes in the program as code errors instead of throwing', () => {
    const result = runUserCode(lines('int main() {', '    int x = 1 / 0;', '    return 0;', '}'))
    expect('error' in result && result.error).toBeInstanceOf(CodeError)
    expect('error' in result && result.error.line).toBe(2)
    expect('error' in result && result.error.text.key).toBe('codeError.divisionByZero')
  })
})
