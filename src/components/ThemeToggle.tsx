import { useTranslation } from '../i18n/useTranslation'
import { useSettingsStore } from '../store/settingsStore'

/** Icon button in the navbar: shows a moon in light mode (go dark) and a sun in dark mode (go light). */
function ThemeToggle() {
  const theme = useSettingsStore((state) => state.theme)
  const toggleTheme = useSettingsStore((state) => state.toggleTheme)
  const { t } = useTranslation()
  const label = theme === 'light' ? t('settings.toDark') : t('settings.toLight')

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-control border border-borderStrong bg-panel text-textMuted transition-colors hover:bg-surface hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {theme === 'light' ? (
          <path d="M16.5 11.8A6.75 6.75 0 0 1 8.2 3.5a6.75 6.75 0 1 0 8.3 8.3Z" />
        ) : (
          <>
            <circle cx="10" cy="10" r="3.5" />
            <path d="M10 1.75v1.5M10 16.75v1.5M1.75 10h1.5M16.75 10h1.5M4.17 4.17l1.06 1.06M14.77 14.77l1.06 1.06M4.17 15.83l1.06-1.06M14.77 5.23l1.06-1.06" />
          </>
        )}
      </svg>
    </button>
  )
}

export default ThemeToggle
