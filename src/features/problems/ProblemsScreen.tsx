import { problemTopics, problems } from '../../data/problems'
import type { Difficulty } from '../../data/problems/types'
import { useTranslation } from '../../i18n/useTranslation'
import { usePlaygroundStore } from '../../store/playgroundStore'
import { BadgeShelf } from './Badges'
import DifficultyBadge from './DifficultyBadge'
import StatementText from './StatementText'

const difficultyOrder: Difficulty[] = ['easy', 'medium', 'hard']

/** The Problems section: every topic that has problems, each with its problems from easiest to hardest. */
function ProblemsScreen() {
  const problemId = usePlaygroundStore((state) => state.problemId)
  const loadProblem = usePlaygroundStore((state) => state.loadProblem)
  const { t, locale } = useTranslation()

  return (
    <div className="flex flex-col gap-7">
      <p className="text-body-md text-textMuted">{t('problems.intro')}</p>
      <BadgeShelf />

      {problemTopics.map((topic) => {
        const topicProblems = problems
          .filter((problem) => problem.topic === topic)
          .sort((a, b) => difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty))
        if (topicProblems.length === 0) return null

        return (
          <section key={topic} className="flex flex-col gap-3.5">
            <h2 className="text-h4 text-text">{t(`problems.topic.${topic}`)}</h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {topicProblems.map((problem) => {
                const isOpen = problem.id === problemId
                return (
                  <button
                    key={problem.id}
                    type="button"
                    onClick={() => loadProblem(problem.id)}
                    className={`flex flex-col overflow-hidden rounded-panel border bg-panel text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      isOpen ? 'border-accent' : 'border-border hover:border-borderStrong'
                    }`}
                  >
                    <div className="flex w-full items-center justify-between gap-3 border-b border-border px-4.5 py-3.5">
                      <span className="text-body-md font-semibold text-text">{problem.title[locale]}</span>
                      <DifficultyBadge difficulty={problem.difficulty} />
                    </div>
                    {/* The statement's first paragraph, cut to three lines. */}
                    <div className="line-clamp-3 w-full flex-1 px-4.5 py-3 text-body-sm text-text">
                      <StatementText text={problem.statement[locale].split('\n\n')[0]} />
                    </div>
                    {isOpen && (
                      <div className="w-full border-t border-border px-4.5 py-3 text-body-sm font-semibold text-accentText">
                        {t('problems.opened')}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

export default ProblemsScreen
