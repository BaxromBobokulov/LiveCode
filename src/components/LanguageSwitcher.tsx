import { useTranslation } from '../i18n/useTranslation'
import { locales, useSettingsStore } from '../store/settingsStore'

/** Three text buttons, UZ / EN / RU, styled like a small version of the navbar tabs. */
function LanguageSwitcher() {
  const locale = useSettingsStore((state) => state.locale)
  const setLocale = useSettingsStore((state) => state.setLocale)
  const { t } = useTranslation()

  return (
    <div role="group" aria-label={t('settings.language')} className="inline-flex h-9 rounded-panel bg-subtle p-0.75">
      {locales.map((option) => {
        const isActive = option === locale
        return (
          <button
            key={option}
            type="button"
            lang={option}
            aria-pressed={isActive}
            onClick={() => setLocale(option)}
            className={`rounded-control px-2 text-label transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              isActive ? 'bg-panel text-text shadow-xs' : 'font-medium text-textMuted hover:text-text'
            }`}
          >
            {option.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

export default LanguageSwitcher
