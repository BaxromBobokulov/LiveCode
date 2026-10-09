import type { ExampleProgram } from '../../engine/types'
import { factorialExample } from './factorial'
import { maxExample } from './max'
import { sumExample } from './sum'

export const examples: ExampleProgram[] = [sumExample, maxExample, factorialExample]

export function getExample(id: string): ExampleProgram {
  return examples.find((example) => example.id === id) ?? examples[0]
}
