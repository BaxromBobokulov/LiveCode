import type { ExampleProgram, Phrase } from '../engine/types'
import { useSettingsStore } from '../store/settingsStore'
import { fill, formatPhrase } from './formatPhrase'
import { translations, type TranslationKey } from './translations'

/**
 * Returns t(key, values) for the current language.
 * "{name}" placeholders in a string are filled from values, e.g.
 * t('execution.stepOf', { current: 3, total: 12 }) -> "Step 3 of 12".
 */
export function useTranslation() {
  const locale = useSettingsStore((state) => state.locale)
  const strings = translations[locale]

  function t(key: TranslationKey, values: Record<string, string | number> = {}) {
    return fill(strings, key, values)
  }

  /** A step explanation or error text in the current language. Several sentences are joined with a space. */
  function phrase(text: Phrase | Phrase[]) {
    return (Array.isArray(text) ? text : [text]).map((p) => formatPhrase(strings, p)).join(' ')
  }

  /** An example's title or tag in the current language, e.g. "example.sum.title". Falls back to the data's English text. */
  function exampleText(example: ExampleProgram, field: 'title' | 'tag') {
    const key = `example.${example.id}.${field}`
    return key in strings ? strings[key as TranslationKey] : example[field]
  }

  return { t, phrase, exampleText, locale }
}
