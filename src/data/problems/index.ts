import { absoluteValueProblem } from './absoluteValue'
import { countDigitsProblem } from './countDigits'
import { countPositivesProblem } from './countPositives'
import { countdownProblem } from './countdown'
import { digitSumProblem } from './digitSum'
import { discountProblem } from './discount'
import { halfOrTripleProblem } from './halfOrTriple'
import { largerOfTwoProblem } from './largerOfTwo'
import { largestDigitProblem } from './largestDigit'
import { largestElementProblem } from './largestElement'
import { letterGradeProblem } from './letterGrade'
import { rowSumsProblem } from './rowSums'
import { studentTotalsProblem } from './studentTotals'
import { sumOfEvensProblem } from './sumOfEvens'
import { sumToNProblem } from './sumToN'
import { timesTableProblem } from './timesTable'
import type { Problem, ProblemTopic } from './types'

export const problems: Problem[] = [
  absoluteValueProblem,
  largerOfTwoProblem,
  letterGradeProblem,
  countdownProblem,
  countDigitsProblem,
  digitSumProblem,
  sumToNProblem,
  rowSumsProblem,
  discountProblem,
  timesTableProblem,
  countPositivesProblem,
  largestElementProblem,
  sumOfEvensProblem,
  halfOrTripleProblem,
  largestDigitProblem,
  studentTotalsProblem,
]

/** Topics in the order the Problems screen lists them. A topic with no problems yet isn't shown. */
export const problemTopics: ProblemTopic[] = ['conditions', 'while', 'for', 'arrays', 'functions']

export function getProblem(id: string): Problem | undefined {
  return problems.find((problem) => problem.id === id)
}
