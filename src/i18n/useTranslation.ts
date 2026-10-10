import type { ExampleProgram } from '../engine/types'
import { useSettingsStore } from '../store/settingsStore'
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
    return strings[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values[name]))
  }

  /** An example's title or tag in the current language, e.g. "example.sum.title". Falls back to the data's English text. */
  function exampleText(example: ExampleProgram, field: 'title' | 'tag') {
    const key = `example.${example.id}.${field}`
    return key in strings ? strings[key as TranslationKey] : example[field]
  }

  return { t, exampleText, locale }
}
