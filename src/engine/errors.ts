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

/**
 * The same unsupported construct in every language, for analytics: "sizeof", "sqrt()", "bitwise <<",
 * "sizeofPointer". Whatever was written inside ( ) or " " is left out, so the student's own code
 * (e.g. the t in time(t)) is never part of it.
 */
export function constructName(error: UnsupportedConstructError): string {
  const { key, values } = error.construct
  const parts = [key === 'construct.code' ? '' : key.replace('construct.', '')]
  for (const value of Object.values(values ?? {})) {
    if (typeof value === 'string') parts.push(value.replace(/\(.*\)/, '()').replace(/".*"/, '""'))
  }
  return parts.filter(Boolean).join(' ')
}

/**
 * A problem with one value of a scanf call. In a call that reads several values,
 * the message says which one, e.g. "Value 2 of 2 in this scanf call: ...".
 */
export function scanfReadError(
  line: number,
  position: number,
  count: number,
  key: TranslationKey,
  values?: Phrase['values'],
): CodeError {
  if (count <= 1) return new CodeError(line, key, values)
  return new CodeError(line, 'codeError.scanfValue', { position, count, problem: { key, values } })
}

/**
 * The `codeError.scanfNoInput` phrase of a program that read more values than it was given,
 * also from inside a `codeError.scanfValue`. Null for any other error.
 */
export function missingInputPhrase(error: RunError): Phrase | null {
  if (!(error instanceof CodeError)) return null
  const { key, values } = error.text
  if (key === 'codeError.scanfNoInput') return error.text
  const problem = values?.problem
  if (key !== 'codeError.scanfValue' || typeof problem !== 'object' || !('key' in problem)) return null
  return problem.key === 'codeError.scanfNoInput' ? problem : null
}

/** Whether Run failed because the Input field had fewer values than the program's scanf calls read. */
export function isMissingInput(error: RunError): boolean {
  return missingInputPhrase(error) !== null
}

/** A C keyword, operator or bit of code named as-is in every language, e.g. "goto" or "sqrt()". */
export function code(text: string): Phrase {
  return { key: 'construct.code', values: { code: text } }
}
