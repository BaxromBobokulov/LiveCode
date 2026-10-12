import { useTranslation } from '../i18n/useTranslation'
import { explanationSizes, useSettingsStore } from '../store/settingsStore'

/** A− / A+ buttons in the navbar: make the step explanation text smaller or larger. Styled like LanguageSwitcher. */
function TextSizeControl() {
  const size = useSettingsStore((state) => state.explanationSize)
  const stepSize = useSettingsStore((state) => state.stepExplanationSize)
  const { t } = useTranslation()

  const buttons = [
    { direction: -1, label: t('settings.textSmaller'), text: 'A−', textClass: 'text-label', atLimit: size === explanationSizes[0] },
    { direction: 1, label: t('settings.textLarger'), text: 'A+', textClass: 'text-body-md', atLimit: size === explanationSizes[explanationSizes.length - 1] },
  ] as const

  return (
    <div role="group" aria-label={t('settings.textSize')} className="inline-flex h-9 rounded-panel bg-subtle p-0.75">
      {buttons.map(({ direction, label, text, textClass, atLimit }) => (
        <button
          key={direction}
          type="button"
          aria-label={label}
          title={label}
          disabled={atLimit}
          onClick={() => stepSize(direction)}
          className={`min-w-7.5 rounded-control px-1.5 font-semibold text-textMuted transition-colors enabled:hover:bg-panel enabled:hover:text-text focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${textClass}`}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export default TextSizeControl
