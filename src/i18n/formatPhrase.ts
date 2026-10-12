import type { Phrase, PhraseValue } from '../engine/types'
import type { TranslationKey } from './translations'

type Strings = Record<TranslationKey, string>

/** Fills the "{name}" placeholders of one string, e.g. "Step {current} of {total}". */
export function fill(strings: Strings, key: TranslationKey, values: Record<string, string | number>) {
  return strings[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]))
}

/**
 * Puts a Phrase from the engine or an example into words, using one language's strings.
 * Nested Phrases are filled in first; a list of Phrases reads "a, b and c".
 */
export function formatPhrase(strings: Strings, { key, values = {} }: Phrase): string {
  const show = (value: PhraseValue): string | number => {
    if (typeof value !== 'object') return value
    if (!Array.isArray(value)) return formatPhrase(strings, value)
    const items = value.map((item) => formatPhrase(strings, item))
    if (items.length <= 1) return items.join('')
    return fill(strings, 'list.and', { items: items.slice(0, -1).join(', '), last: items[items.length - 1] })
  }
  return fill(strings, key, Object.fromEntries(Object.entries(values).map(([name, value]) => [name, show(value)])))
}
