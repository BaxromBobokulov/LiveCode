import type { Difficulty } from '../../data/problems/types'
import { useTranslation } from '../../i18n/useTranslation'

const levels: Record<Difficulty, number> = { easy: 1, medium: 2, hard: 3 }
// Rising bars, like a signal meter: the taller the last filled bar, the harder the problem.
const barHeights = ['h-1.5', 'h-2.5', 'h-3.5']

/**
 * "Easy" / "Medium" / "Hard", with a 1-, 2- or 3-bar meter in front, so difficulty reads at a glance and
 * looks nothing like the topic chip next to it. The level is told by how many bars are filled (shape and
 * lightness: accent vs borderStrong) and by the word, never by color alone.
 */
function DifficultyBadge({ difficulty }: { difficulty: Difficulty }) {
  const { t } = useTranslation()
  const level = levels[difficulty]
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-label text-text">
      <span aria-hidden="true" className="flex items-end gap-0.5">
        {barHeights.map((height, i) => (
          <span key={height} className={`w-1 rounded-full ${height} ${i < level ? 'bg-accent' : 'bg-borderStrong'}`} />
        ))}
      </span>
      {t(`problems.difficulty.${difficulty}`)}
    </span>
  )
}

export default DifficultyBadge
