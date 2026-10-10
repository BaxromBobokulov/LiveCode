import { describe, expect, it } from 'vitest'
import { CodeError, UnsupportedConstructError } from './errors'
import { runUserCode } from './interpreter'
import type { Step } from './types'

function stepsOf(source: string): Step[] {
  const result = runUserCode(source)
  if ('error' in result) throw new Error(`Unexpected error on line ${result.error.line}: ${result.error.message}`)
  return result.steps
}

const lines = (...code: string[]) => code.join('\n')

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
    expect(steps[0].explanation).toBe('Create a and set it to 2.')
    expect(steps[1].variables).toContainEqual({ name: 'b', value: '?' })
    expect(steps[2].explanation).toBe('Set b to a * 3: 2 * 3 = 6.')
    expect(steps[2].changed).toEqual(['b'])
    expect(steps[3].output).toBe('b = 6\n')
    expect(steps[4].explanation).toBe('Return 0 from main. The program finished successfully.')
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
    expect(checks[0].explanation).toBe('Start the loop: create i and set it to 0. Check i < 3: 0 < 3 is true, so run the loop body.')
    expect(checks[1].explanation).toBe('Increase i to 1. Check i < 3: 1 < 3 is true, so run the loop body again.')
    expect(checks[3].explanation).toBe('Increase i to 3. Check i < 3: 3 < 3 is false, so the loop ends.')
    expect(checks[3].loop).toBeNull()

    const bodySteps = steps.filter((s) => s.line === 5)
    expect(bodySteps.map((s) => s.loop)).toEqual([
      { line: 4, iteration: 1, total: 3 },
      { line: 4, iteration: 2, total: 3 },
      { line: 4, iteration: 3, total: 3 },
    ])
    expect(bodySteps[1].array).toEqual({ name: 'arr', values: [4, 8, 15], activeIndex: 1 })
    expect(bodySteps[1].explanation).toBe('Set sum to sum + arr[i]: 4 + 8 = 12.')
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
    expect(steps[1].explanation).toBe('Check if x > 5: 3 > 5 is false, so check the next condition.')
    expect(steps[2].explanation).toBe('Check else if x > 1: 3 > 1 is true, so run this else if block.')
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
    expect(steps[0].explanation).toBe('Call add(2, 3). Inside add, a = 2 and b = 3.')
    expect(steps[0].variables).toEqual([
      { name: 'a', value: '2' },
      { name: 'b', value: '3' },
    ])
    expect(steps[1].explanation).toBe('Leave add and go back to main, returning a + b: 2 + 3 = 5.')
    expect(steps[2].explanation).toBe('Create s and set it to add(2, 3) (5).')
    expect(steps[3].output).toBe('5\n')
  })

  it('reports a pointer as not supported, with its line', () => {
    const result = runUserCode(lines('int main() {', '    int x = 1;', '    int *p = &x;', '    return 0;', '}'))

    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error).toBeInstanceOf(UnsupportedConstructError)
    expect(result.error).toMatchObject({ line: 3, construct: 'pointer' })
  })

  it('reports mistakes in the program as code errors instead of throwing', () => {
    const result = runUserCode(lines('int main() {', '    int x = 1 / 0;', '    return 0;', '}'))
    expect('error' in result && result.error).toBeInstanceOf(CodeError)
    expect('error' in result && result.error.line).toBe(2)
  })
})
