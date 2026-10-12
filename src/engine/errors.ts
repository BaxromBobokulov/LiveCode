// Errors the engine reports back to the Playground instead of crashing.
// Both carry the 1-based source line so the UI can point at it.
import type { TranslationKey } from '../i18n/translations'
import type { Phrase } from './types'

/** Valid C that uses something this version can't run yet, e.g. a pointer or a struct. */
export class UnsupportedConstructError extends Error {
  readonly line: number
  /** Short name of the feature, e.g. "pointer" or "switch statement". */
  readonly construct: Phrase
  readonly text: Phrase

  constructor(line: number, construct: Phrase, text: Phrase) {
    super(text.key)
    this.name = 'UnsupportedConstructError'
    this.line = line
    this.construct = construct
    this.text = text
  }
}

/** A mistake in the program itself, e.g. a missing semicolon or a division by zero. */
export class CodeError extends Error {
  readonly line: number
  readonly text: Phrase

  constructor(line: number, key: TranslationKey, values?: Phrase['values']) {
    super(key)
    this.name = 'CodeError'
    this.line = line
    this.text = { key, values }
  }
}

export type RunError = UnsupportedConstructError | CodeError

/** A C keyword, operator or bit of code named as-is in every language, e.g. "goto" or "sqrt()". */
export function code(text: string): Phrase {
  return { key: 'construct.code', values: { code: text } }
}
