import type { Phrase, PhraseValue } from '../engine/types'
import type { TranslationKey } from './translations'

type Strings = Record<TranslationKey, string>

/**
 * A piece of a finished sentence: translated prose, or a code token filled in from the Phrase's
 * values (a variable or array name, a number, an expression like "4 + 8"). The UI shows code
 * tokens in the mono font, so they stand out from the words around them.
 */
export type PhrasePart = string | { code: string }

/** Fills the "{name}" placeholders of one string, e.g. "Step {current} of {total}". */
export function fill(strings: Strings, key: TranslationKey, values: Record<string, string | number>) {
  return strings[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]))
}

/** Like fill(), but each placeholder is replaced by a list of parts. A missing value keeps its "{name}". */
function fillParts(strings: Strings, key: TranslationKey, values: Record<string, PhrasePart[]>): PhrasePart[] {
  // split() with a capture group alternates: text, placeholder name, text, placeholder name, ...
  return strings[key].split(/\{(\w+)\}/).flatMap((piece, i) => {
    if (i % 2 === 0) return piece === '' ? [] : [piece]
    return values[piece] ?? [`{${piece}}`]
  })
}

/**
 * Puts a Phrase from the engine or an example into words, using one language's strings.
 * Nested Phrases are filled in first; a list of Phrases reads "a, b and c".
 * Plain values (names, numbers, code) become code parts.
 */
export function phraseParts(strings: Strings, { key, values = {} }: Phrase): PhrasePart[] {
  const show = (value: PhraseValue): PhrasePart[] => {
    if (typeof value !== 'object') return value === '' ? [] : [{ code: String(value) }]
    if (!Array.isArray(value)) return phraseParts(strings, value)
    const items = value.map((item) => phraseParts(strings, item))
    if (items.length <= 1) return items.flat()
    const allButLast = items.slice(0, -1).flatMap((item, i) => (i === 0 ? item : [', ', ...item]))
    return fillParts(strings, 'list.and', { items: allButLast, last: items[items.length - 1] })
  }
  return fillParts(strings, key, Object.fromEntries(Object.entries(values).map(([name, value]) => [name, show(value)])))
}

/** The same sentence as plain text, e.g. for a string inside another translation. */
export function formatPhrase(strings: Strings, phrase: Phrase): string {
  return phraseParts(strings, phrase)
    .map((part) => (typeof part === 'string' ? part : part.code))
    .join('')
}
