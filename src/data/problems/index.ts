import { absoluteValueProblem } from './absoluteValue'
import { countDigitsProblem } from './countDigits'
import { countdownProblem } from './countdown'
import { digitSumProblem } from './digitSum'
import { largerOfTwoProblem } from './largerOfTwo'
import { letterGradeProblem } from './letterGrade'
import type { Problem, ProblemTopic } from './types'

export const problems: Problem[] = [
  absoluteValueProblem,
  largerOfTwoProblem,
  letterGradeProblem,
  countdownProblem,
  countDigitsProblem,
  digitSumProblem,
]

/** Topics in the order the Problems screen lists them. A topic with no problems yet isn't shown. */
export const problemTopics: ProblemTopic[] = ['conditions', 'while', 'for', 'arrays', 'functions']

export function getProblem(id: string): Problem | undefined {
  return problems.find((problem) => problem.id === id)
}
