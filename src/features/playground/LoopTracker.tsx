import type { LoopInfo } from '../../engine/types'
import { useTranslation } from '../../i18n/useTranslation'

type LoopTrackerProps = {
  /** null: a step outside any loop, in a program that has one. The card stays, so nothing below it moves. */
  loop: LoopInfo | null
  /** Source text of the loop header line, e.g. "for (i = 0; i < 5; i++) {" */
  header: string
}

function LoopTracker({ loop, header }: LoopTrackerProps) {
  const { t } = useTranslation()

  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">{t('panel.loop')}</h3>
      <div className="rounded-container border border-border bg-panel px-3.5 py-3">
        {loop ? (
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <code className="font-mono text-body-sm text-text">{header.replace(/\s*\{$/, '')}</code>
            <span className="text-body-sm font-semibold text-text">
              {t('loop.iterationOf', { current: loop.iteration, total: loop.total })}
            </span>
          </div>
        ) : (
          <p className="text-body-sm text-textMuted">{t('loop.none')}</p>
        )}
        {/* Kept, but invisible, outside a loop: an empty bar would read as "iteration 0". */}
        <div className={`mt-2.5 flex gap-1 ${loop ? '' : 'invisible'}`} aria-hidden="true">
          {Array.from({ length: loop?.total ?? 1 }, (_, index) => (
            <div
              key={index}
              className={`h-1.25 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                loop && index < loop.iteration ? 'bg-accent' : 'bg-track'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default LoopTracker
