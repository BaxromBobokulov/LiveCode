import type { LoopInfo } from '../../engine/types'
import { useTranslation } from '../../i18n/useTranslation'

type LoopTrackerProps = {
  loop: LoopInfo
  /** Source text of the loop header line, e.g. "for (i = 0; i < 5; i++) {" */
  header: string
}

function LoopTracker({ loop, header }: LoopTrackerProps) {
  const { t } = useTranslation()

  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">{t('panel.loop')}</h3>
      <div className="rounded-container border border-border px-3.5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <code className="font-mono text-body-sm text-text">{header.replace(/\s*\{$/, '')}</code>
          <span className="text-body-sm font-semibold text-text">
            {t('loop.iterationOf', { current: loop.iteration, total: loop.total })}
          </span>
        </div>
        <div className="mt-2.5 flex gap-1" aria-hidden="true">
          {Array.from({ length: loop.total }, (_, index) => (
            <div
              key={index}
              className={`h-1.25 flex-1 rounded-full transition-colors duration-200 motion-reduce:transition-none ${
                index < loop.iteration ? 'bg-accent' : 'bg-track'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default LoopTracker
