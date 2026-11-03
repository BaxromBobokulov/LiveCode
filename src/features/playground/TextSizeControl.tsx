import Tooltip from '../../components/Tooltip'
import { useTranslation } from '../../i18n/useTranslation'
import { explanationSizes, useSettingsStore } from '../../store/settingsStore'

/**
 * A− / A+ buttons in the Execution panel's header: make the step explanation text smaller or larger.
 * It sits there, not in the navbar, because it only changes that panel's explanation. Styled like LanguageSwitcher.
 */
function TextSizeControl() {
  const size = useSettingsStore((state) => state.explanationSize)
  const stepSize = useSettingsStore((state) => state.stepExplanationSize)
  const { t } = useTranslation()

  const buttons = [
    { direction: -1, label: t('settings.textSmaller'), text: 'A−', textClass: 'text-label', atLimit: size === explanationSizes[0] },
    { direction: 1, label: t('settings.textLarger'), text: 'A+', textClass: 'text-body-md', atLimit: size === explanationSizes[explanationSizes.length - 1] },
  ] as const

  return (
    <div role="group" aria-label={t('settings.textSize')} className="inline-flex h-9 shrink-0 rounded-panel bg-subtle p-0.75">
      {buttons.map(({ direction, label, text, textClass, atLimit }) => (
        // The ::before is an invisible 44px-tall hit area centered on the 30px button, as in SpeedControl
        <Tooltip key={direction} label={label}>
          <button
            type="button"
            aria-label={label}
            disabled={atLimit}
            onClick={() => stepSize(direction)}
            className={`relative min-w-7.5 rounded-control px-1.5 font-semibold text-textMuted transition-colors before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] enabled:hover:bg-panel enabled:hover:text-text focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-40 ${textClass}`}
          >
            {text}
          </button>
        </Tooltip>
      ))}
    </div>
  )
}

export default TextSizeControl
