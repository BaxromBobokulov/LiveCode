import { useId } from 'react'
import { useTranslation } from '../../i18n/useTranslation'
import { playbackSpeeds, useSettingsStore } from '../../store/settingsStore'

/** "Speed 0.5× 1× 1.5× 2×" next to the step controls: how fast Auto Play moves. Styled like LanguageSwitcher. */
function SpeedControl() {
  const speed = useSettingsStore((state) => state.playbackSpeed)
  const setSpeed = useSettingsStore((state) => state.setPlaybackSpeed)
  const locale = useSettingsStore((state) => state.locale)
  const { t } = useTranslation()
  const labelId = useId()

  return (
    <div className="flex items-center gap-2">
      <span id={labelId} className="text-label font-medium text-textMuted">
        {t('playback.speed')}
      </span>
      <div role="group" aria-labelledby={labelId} className="inline-flex h-9 rounded-panel bg-subtle p-0.75">
        {playbackSpeeds.map((option) => {
          const isActive = option === speed
          return (
            // The ::before is an invisible 44px-tall hit area centered on the 30px pill, so the touch
            // target passes AGENTS.md's 44px rule while the row looks the same.
            <button
              key={option}
              type="button"
              aria-pressed={isActive}
              onClick={() => setSpeed(option)}
              className={`relative rounded-control px-2 before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-[''] text-label tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                isActive ? 'bg-panel text-text shadow-xs' : 'font-medium text-textMuted hover:text-text'
              }`}
            >
              {/* Decimals as the current language writes them: 0.5 in English, 0,5 in Russian */}
              {option.toLocaleString(locale)}×
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default SpeedControl
