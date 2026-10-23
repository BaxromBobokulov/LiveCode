import { useTranslation } from '../../i18n/useTranslation'
import { ACTIVE_DAYS_GOAL, badgeIds, useBadgesStore, type BadgeId } from '../../store/badgesStore'

/**
 * A badge's round icon: a star for the first correct solution, a calendar for the active days.
 * Unlocked, it uses the same success tokens as a passed Check's summary line; locked, a dashed grey
 * outline, so the two differ in more than color.
 */
export function BadgeIcon({ id, unlocked }: { id: BadgeId; unlocked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-9 shrink-0 items-center justify-center rounded-full border ${
        unlocked ? 'border-success bg-successTint text-successText' : 'border-dashed border-borderStrong text-textMuted'
      }`}
    >
      <svg viewBox="0 0 16 16" className="size-4.5">
        {id === 'firstSolve' ? (
          <path
            d="M8 1.75l1.9 3.85 4.25.62-3.08 3 .73 4.23L8 11.45 4.2 13.45l.73-4.23-3.08-3 4.25-.62z"
            fill={unlocked ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        ) : (
          <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="12" height="11" rx="2" />
            <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3M5.75 10.25l1.5 1.5 3-3" />
          </g>
        )}
      </svg>
    </span>
  )
}

/**
 * Every badge, unlocked or not, at the top of the Problems section. A locked 'activeDays' badge shows how
 * many days are done. Ends with a line saying the badges live on this device only, since there is no account.
 */
export function BadgeShelf() {
  const unlocked = useBadgesStore((state) => state.unlocked)
  const passDays = useBadgesStore((state) => state.passDays)
  const { t } = useTranslation()

  return (
    <section className="rounded-panel border border-border bg-panel">
      <header className="flex h-11.75 items-center border-b border-border px-4.5">
        <h2 className="text-body-md font-semibold">{t('badges.title')}</h2>
      </header>
      <div className="flex flex-col gap-3.5 p-4.5">
        <ul className="grid gap-3.5 sm:grid-cols-2">
          {badgeIds.map((id) => {
            const isUnlocked = unlocked.includes(id)
            return (
              <li key={id} className="flex items-start gap-3">
                <BadgeIcon id={id} unlocked={isUnlocked} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-body-md font-semibold text-text">{t(`badge.${id}.title`)}</span>
                  <span className="text-body-sm text-textMuted">{t(`badge.${id}.description`)}</span>
                  <span className={`text-body-sm font-semibold ${isUnlocked ? 'text-successText' : 'text-textMuted'}`}>
                    {isUnlocked
                      ? t('badges.unlocked')
                      : id === 'activeDays'
                        ? t('badges.progress', { count: passDays.length, goal: ACTIVE_DAYS_GOAL })
                        : t('badges.locked')}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="text-body-sm text-textMuted">{t('badges.deviceOnly')}</p>
      </div>
    </section>
  )
}
