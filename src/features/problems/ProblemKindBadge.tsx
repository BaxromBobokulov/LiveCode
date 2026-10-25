import type { ProblemKind } from '../../data/problems/types'
import { useTranslation } from '../../i18n/useTranslation'

// A pencil for writing a program, a bug for fixing one.
const icons: Record<ProblemKind, string> = {
  write: 'M3 13l1-3.5 6.5-6.5 2.5 2.5L6.5 12zM9.5 4l2.5 2.5',
  debug:
    'M5.5 6.5a2.5 2.5 0 0 1 5 0V10a2.5 2.5 0 0 1-5 0zM6.5 4.5 5 3M9.5 4.5 11 3M5.5 8H3M13 8h-2.5M5.5 10.5l-2 1.5M10.5 10.5l2 1.5M8 6.5V12',
}

/**
 * "Write code" / "Find the bug", so a student knows before opening a problem whether they write the
 * program or fix the one given. An outlined label with an icon: unlike the tinted topic chip and the
 * difficulty meter, and told apart by its icon and word, not by color.
 */
function ProblemKindBadge({ kind }: { kind: ProblemKind }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex h-4.75 shrink-0 items-center gap-1 rounded-control border border-borderStrong px-1.5 text-label text-text">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5">
        <path d={icons[kind]} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {t(`problems.kind.${kind}`)}
    </span>
  )
}

export default ProblemKindBadge
