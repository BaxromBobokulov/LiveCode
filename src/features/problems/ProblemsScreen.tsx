import { useId, useState } from 'react'
import Button from '../../components/Button'
import { problemTopics, problems } from '../../data/problems'
import type { Difficulty } from '../../data/problems/types'
import { useTranslation } from '../../i18n/useTranslation'
import { useBadgesStore } from '../../store/badgesStore'
import { usePlaygroundStore } from '../../store/playgroundStore'
import { useSettingsStore } from '../../store/settingsStore'
import { BadgeShelf } from './Badges'
import DifficultyBadge from './DifficultyBadge'
import ProblemKindBadge from './ProblemKindBadge'
import { normalizeForSearch } from './problemList'
import StatementText from './StatementText'

const difficultyOrder: Difficulty[] = ['easy', 'medium', 'hard']

/**
 * The Problems section: every topic that has problems, each with its problems from easiest to hardest.
 * Topics fold, and the search above them narrows the list by title.
 */
function ProblemsScreen() {
  const problemId = usePlaygroundStore((state) => state.problemId)
  const loadProblem = usePlaygroundStore((state) => state.loadProblem)
  const loadRandomProblem = usePlaygroundStore((state) => state.loadRandomProblem)
  const passedProblems = useBadgesStore((state) => state.passedProblems)
  const collapsedTopics = useSettingsStore((state) => state.collapsedTopics)
  const toggleTopic = useSettingsStore((state) => state.toggleTopic)
  const { t, locale } = useTranslation()
  const [search, setSearch] = useState('')
  const searchId = useId()

  const query = normalizeForSearch(search)
  const isSearching = query !== ''
  const sections = problemTopics
    .map((topic) => {
      const topicProblems = problems
        .filter((problem) => problem.topic === topic)
        .sort((a, b) => difficultyOrder.indexOf(a.difficulty) - difficultyOrder.indexOf(b.difficulty))
      return {
        topic,
        topicProblems,
        shownProblems: topicProblems.filter((problem) => normalizeForSearch(problem.title[locale]).includes(query)),
      }
    })
    .filter(({ shownProblems }) => shownProblems.length > 0)

  return (
    <div className="flex flex-col gap-7">
      <p className="text-body-md text-textMuted">{t('problems.intro')}</p>
      <BadgeShelf />

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={searchId} className="sr-only">
          {t('problems.search')}
        </label>
        <input
          id={searchId}
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('problems.search')}
          spellCheck={false}
          autoComplete="off"
          className="h-11 min-w-0 flex-1 basis-60 rounded-control border border-borderStrong bg-panel px-3.5 text-body-sm text-text transition-colors placeholder:text-textMuted focus-visible:outline-2 focus-visible:outline-accent"
        />
        <Button variant="secondary" className="min-h-11" onClick={loadRandomProblem}>
          {t('problems.random')}
        </Button>
      </div>

      {sections.length === 0 && (
        <p role="status" className="text-body-md text-textMuted">
          {t('problems.noMatches', { query: search.trim() })}
        </p>
      )}

      {sections.map(({ topic, topicProblems, shownProblems }) => {
        // A search looks inside folded topics too, without changing what is saved as folded.
        const isCollapsed = !isSearching && collapsedTopics.includes(topic)
        const passedCount = topicProblems.filter((problem) => passedProblems.includes(problem.id)).length
        const panelId = `problems-topic-${topic}`

        return (
          <section key={topic} className="flex flex-col gap-3.5">
            <h2 className="text-h4 text-text">
              <button
                type="button"
                aria-expanded={!isCollapsed}
                aria-controls={panelId}
                disabled={isSearching}
                onClick={() => toggleTopic(topic)}
                className="flex min-h-11 w-full flex-wrap items-center gap-x-2.5 rounded-control text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 12 12"
                  className={`size-3.5 shrink-0 text-textMuted ${isCollapsed ? '-rotate-90' : ''}`}
                >
                  <path
                    d="M2.5 4.5 6 8l3.5-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t(`problems.topic.${topic}`)}
                <span className="text-body-sm font-normal text-textMuted">
                  {t('problems.progress', { solved: passedCount, total: topicProblems.length })}
                </span>
              </button>
            </h2>
            <div id={panelId} hidden={isCollapsed} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shownProblems.map((problem) => {
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
                    <div className="w-full px-4.5 pt-3">
                      <ProblemKindBadge kind={problem.kind} />
                    </div>
                    {/* The statement's first paragraph, cut to three lines. */}
                    <div className="line-clamp-3 w-full flex-1 px-4.5 pt-2 pb-3 text-body-sm text-text">
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
