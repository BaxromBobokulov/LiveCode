import type { Problem } from '../../data/problems/types'
import type { RunError } from '../../engine/errors'
import { runUserCode } from '../../engine/interpreter'

/** How the student's program did on one test case. */
export type CaseResult = {
  /** The values scanf read on this run ('' when the test case has none). */
  input: string
  expectedOutput: string
  /** What the program printed, or null when it stopped with an error before finishing. */
  actualOutput: string | null
  /** Why the program stopped, if it did. */
  error: RunError | null
  passed: boolean
  /** The first output line (1-based) that differs from the expected one, or null when they match or there is an error. */
  differentLine: number | null
}

export type CheckResult = {
  /** True when every test case passed. */
  passed: boolean
  cases: CaseResult[]
}

/**
 * Output lines as they are compared: spaces at the end of a line and blank lines at the very end
 * are ignored, since a beginner can't see them in the Console and they don't change the answer.
 */
function outputLines(output: string): string[] {
  return output.trimEnd().split('\n').map((line) => line.trimEnd())
}

function firstDifferentLine(actual: string, expected: string): number | null {
  const actualLines = outputLines(actual)
  const expectedLines = outputLines(expected)
  for (let i = 0; i < Math.max(actualLines.length, expectedLines.length); i++) {
    if (actualLines[i] !== expectedLines[i]) return i + 1
  }
  return null
}

/**
 * Runs the student's code once per test case and compares what it prints with the expected output.
 * Each case's `input` goes to runUserCode exactly as Run passes the Input field's text.
 */
export function checkSolution(problem: Problem, code: string): CheckResult {
  const cases = problem.testCases.map(({ input = '', expectedOutput }): CaseResult => {
    const result = runUserCode(code, input)
    if ('error' in result) {
      return { input, expectedOutput, actualOutput: null, error: result.error, passed: false, differentLine: null }
    }
    const actualOutput = result.steps.at(-1)?.output ?? ''
    const differentLine = firstDifferentLine(actualOutput, expectedOutput)
    return { input, expectedOutput, actualOutput, error: null, passed: differentLine === null, differentLine }
  })
  return { passed: cases.every((testCase) => testCase.passed), cases }
}
