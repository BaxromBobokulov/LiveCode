import { describe, expect, it } from 'vitest'
import { problems } from '../../data/problems'
import { absoluteValueProblem } from '../../data/problems/absoluteValue'
import { countDigitsProblem } from '../../data/problems/countDigits'
import { countdownProblem } from '../../data/problems/countdown'
import { countPositivesProblem } from '../../data/problems/countPositives'
import { discountProblem } from '../../data/problems/discount'
import { halfOrTripleProblem } from '../../data/problems/halfOrTriple'
import { largerOfTwoProblem } from '../../data/problems/largerOfTwo'
import { largestDigitProblem } from '../../data/problems/largestDigit'
import { largestElementProblem } from '../../data/problems/largestElement'
import { rowSumsProblem } from '../../data/problems/rowSums'
import { studentTotalsProblem } from '../../data/problems/studentTotals'
import { sumOfEvensProblem } from '../../data/problems/sumOfEvens'
import { sumToNProblem } from '../../data/problems/sumToN'
import { timesTableProblem } from '../../data/problems/timesTable'
import { CodeError, UnsupportedConstructError } from '../../engine/errors'
import { parse } from '../../engine/parser'
import { checkSolution } from './checkSolution'

const lines = (...code: string[]) => code.join('\n')

const absoluteValueSolution = lines(
  '#include <stdio.h>',
  'int main() {',
  '    int n;',
  '    scanf("%d", &n);',
  '    if (n < 0) {',
  '        n = -n;',
  '    }',
  '    printf("%d\\n", n);',
  '    return 0;',
  '}',
)

// One correct solution per problem, so a problem whose expected output is wrong is caught here.
const solutions: Record<string, string> = {
  absoluteValue: absoluteValueSolution,
  letterGrade: lines(
    '#include <stdio.h>',
    'int main() {',
    '    int score;',
    '    scanf("%d", &score);',
    '    if (score >= 90) {',
    '        printf("A\\n");',
    '    } else if (score >= 75) {',
    '        printf("B\\n");',
    '    } else if (score >= 60) {',
    '        printf("C\\n");',
    '    } else {',
    '        printf("F\\n");',
    '    }',
    '    return 0;',
    '}',
  ),
  countdown: lines(
    '#include <stdio.h>',
    'int main() {',
    '    int i;',
    '    scanf("%d", &i);',
    '    while (i >= 1) {',
    '        printf("%d\\n", i);',
    '        i--;',
    '    }',
    '    return 0;',
    '}',
  ),
  largerOfTwo: lines(
    '#include <stdio.h>',
    'int main() {',
    '    int a, b;',
    '    scanf("%d %d", &a, &b);',
    '    if (a > b) {',
    '        printf("%d\\n", a);',
    '    } else {',
    '        printf("%d\\n", b);',
    '    }',
    '    return 0;',
    '}',
  ),
  countDigits: lines(
    '#include <stdio.h>',
    'int main() {',
    '    int n;',
    '    int count = 0;',
    '    scanf("%d", &n);',
    '    while (n > 0) {',
    '        n = n / 10;',
    '        count++;',
    '    }',
    '    printf("%d\\n", count);',
    '    return 0;',
    '}',
  ),
  digitSum: lines(
    '#include <stdio.h>',
    'int main() {',
    '    int n;',
    '    int sum = 0;',
    '    scanf("%d", &n);',
    '    while (n > 0) {',
    '        sum += n % 10;',
    '        n = n / 10;',
    '    }',
    '    printf("%d\\n", sum);',
    '    return 0;',
    '}',
  ),
  // The debug problems' starter code with its one mistake fixed.
  sumToN: sumToNProblem.starterCode!.join('\n').replace('i < n', 'i <= n'),
  rowSums: rowSumsProblem.starterCode!.join('\n').replace('grid[j][i]', 'grid[i][j]'),
  discount: discountProblem.starterCode!.join('\n').replace('if (price > 100);', 'if (price > 100)'),
  timesTable: timesTableProblem.starterCode!.join('\n').replace('n * i);', 'n * i);\n        i++;'),
  countPositives: countPositivesProblem.starterCode!.join('\n').replace('for (i = 1;', 'for (i = 0;'),
  largestElement: largestElementProblem.starterCode!.join('\n').replace('i <= 5', 'i < 5'),
  sumOfEvens: sumOfEvensProblem.starterCode!.join('\n').replace('while (i <= n);', 'while (i <= n)'),
  halfOrTriple: halfOrTripleProblem.starterCode!.join('\n').replace('if (n % 2 != 0)', 'else'),
  largestDigit: largestDigitProblem.starterCode!.join('\n').replace('largest == digit', 'largest = digit'),
  studentTotals: studentTotalsProblem.starterCode!.join('\n').replace(', total);', ', total);\n        total = 0;'),
}

describe('checkSolution', () => {
  it.each(problems.map((problem) => [problem.id, problem] as const))('passes a correct solution to %s', (id, problem) => {
    expect(solutions[id]).toBeDefined()
    expect(checkSolution(problem, solutions[id]).passed).toBe(true)
  })

  // Every problem reads input, so printing one test case's answer as a fixed text must fail another case.
  it.each(problems.map((problem) => [problem.id, problem] as const))('fails every hardcoded answer to %s', (_, problem) => {
    for (const { expectedOutput } of problem.testCases) {
      const fixed = lines('int main() {', `    printf("${expectedOutput.replace(/\n/g, '\\n')}");`, '    return 0;', '}')
      expect(checkSolution(problem, fixed).passed).toBe(false)
    }
  })

  // A debug problem's starter code is valid code in the supported subset that fails Check: a wrong answer,
  // or a runtime mistake like a loop that never ends — never a syntax error or a "Not supported yet".
  it.each(problems.filter((problem) => problem.kind === 'debug').map((problem) => [problem.id, problem] as const))(
    'fails the buggy starter code of %s with a wrong answer or a runtime error',
    (_, problem) => {
      expect(problem.starterCode).toBeDefined()
      const code = problem.starterCode!.join('\n')
      expect(() => parse(code)).not.toThrow()
      const result = checkSolution(problem, code)
      expect(result.passed).toBe(false)
      expect(result.cases.every((testCase) => !(testCase.error instanceof UnsupportedConstructError))).toBe(true)
    },
  )

  it('fails the untouched starter code and says which line differs', () => {
    const result = checkSolution(absoluteValueProblem, absoluteValueProblem.starterCode!.join('\n'))
    expect(result.passed).toBe(false)
    expect(result.cases[0]).toMatchObject({ actualOutput: '-7\n', expectedOutput: '7\n', differentLine: 1, error: null })
  })

  it('ignores a missing final newline and spaces at the end of a line', () => {
    const code = absoluteValueSolution.replace('"%d\\n"', '"%d  "')
    expect(checkSolution(absoluteValueProblem, code).passed).toBe(true)
  })

  it('points at the first different line when only part of the output is wrong', () => {
    const code = solutions.countdown.replace('i >= 1', 'i >= 2')
    expect(checkSolution(countdownProblem, code).cases[0].differentLine).toBe(5)
  })

  it('reports a program that stops with an error as failed, with the error', () => {
    const result = checkSolution(absoluteValueProblem, absoluteValueSolution.replace('n = -n;', 'n = -n'))
    expect(result.passed).toBe(false)
    expect(result.cases[0].actualOutput).toBeNull()
    expect(result.cases[0].error).toBeInstanceOf(CodeError)
  })

  it('feeds each test case its own input, the way Run feeds the Input field', () => {
    const result = checkSolution(largerOfTwoProblem, solutions.largerOfTwo)
    expect(result.cases.map((testCase) => testCase.input)).toEqual(['3 8', '15 4', '7 7'])
    expect(result.cases.map((testCase) => testCase.actualOutput)).toEqual(['8\n', '15\n', '7\n'])
  })

  it('fails a hardcoded answer on the cases it was not written for, and says which', () => {
    const hardcoded = lines('#include <stdio.h>', 'int main() {', '    printf("8\\n");', '    return 0;', '}')
    const result = checkSolution(largerOfTwoProblem, hardcoded)
    expect(result.passed).toBe(false)
    expect(result.cases.map((testCase) => testCase.passed)).toEqual([true, false, false])
    expect(result.cases[1]).toMatchObject({ actualOutput: '8\n', expectedOutput: '15\n', differentLine: 1 })
  })

  it('fails a solution that only handles one input correctly, on that case alone', () => {
    // Prints b unless a is larger *and* negative: right for "3 8" and "7 7", wrong for "15 4".
    const onlyB = solutions.largerOfTwo.replace('if (a > b)', 'if (a > b && a < 0)')
    const result = checkSolution(largerOfTwoProblem, onlyB)
    expect(result.cases.map((testCase) => testCase.passed)).toEqual([true, false, true])
  })

  it('reports each case that runs out of input as an error', () => {
    // Reads a second number that none of the test cases give.
    const greedy = solutions.countDigits.replace('scanf("%d", &n);', 'scanf("%d", &n);\n    int extra;\n    scanf("%d", &extra);')
    const result = checkSolution(countDigitsProblem, greedy)
    expect(result.cases.every((testCase) => testCase.error instanceof CodeError)).toBe(true)
  })

  it('never runs out of input just because the Input field is empty: each test brings its own values', () => {
    const result = checkSolution(countDigitsProblem, solutions.countDigits)
    expect(result.cases.every((testCase) => testCase.error === null)).toBe(true)
  })
})
