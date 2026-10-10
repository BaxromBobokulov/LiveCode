import type { ExampleProgram } from '../../engine/types'
import { bubbleSortExample } from './bubbleSort'
import { factorialExample } from './factorial'
import { fibonacciExample } from './fibonacci'
import { matrixExample } from './matrix'
import { maxExample } from './max'
import { sumExample } from './sum'

export const examples: ExampleProgram[] = [
  sumExample,
  maxExample,
  factorialExample,
  fibonacciExample,
  bubbleSortExample,
  matrixExample,
]

export function getExample(id: string): ExampleProgram {
  return examples.find((example) => example.id === id) ?? examples[0]
}
