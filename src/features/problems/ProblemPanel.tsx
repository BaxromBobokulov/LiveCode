import type { ReactNode } from 'react'
import Button from '../../components/Button'
import Chip from '../../components/Chip'
import { TELEGRAM_GROUP_URL } from '../../constants/links'
import type { Problem } from '../../data/problems/types'
import { UnsupportedConstructError } from '../../engine/errors'
import { useTranslation } from '../../i18n/useTranslation'
import { usePlaygroundStore } from '../../store/playgroundStore'
import { BadgeIcon } from './Badges'
import type { CaseResult, CheckResult } from './checkSolution'
import DifficultyBadge from './DifficultyBadge'
import ProblemKindBadge from './ProblemKindBadge'
import StatementText from './StatementText'

/** A check mark or a cross, so a result isn't told by color alone. */
function ResultIcon({ passed }: { passed: boolean }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={`size-4 shrink-0 ${passed ? 'text-successText' : 'text-error'}`}>
      <path
        d={passed ? 'M3 8.5 6.5 12 13 4.5' : 'M4 4l8 8M12 4l-8 8'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Whether every case stopped with the same error, e.g. a missing semicolon: that error is the same
 * whatever the input, so it is shown once instead of once per case.
 */
function sameErrorEverywhere({ cases }: CheckResult): boolean {
  const [first] = cases
  return cases.every(
    ({ error }) =>
      error !== null &&
      error.line === first.error?.line &&
      JSON.stringify(error.text) === JSON.stringify(first.error.text),
  )
}

/**
 * One program output inline, as code. A multi-line output keeps its line breaks. No output at all is said
 * in plain muted words, with no box around it, so it can't be mistaken for a field to type in.
 */
function InlineOutput({ output }: { output: string }) {
  const { t } = useTranslation()
  const text = output.replace(/\n$/, '')
  if (!text) return <span className="text-textMuted">{t('check.noOutput')}</span>
  return (
    <code className="inline-block rounded-control bg-surface px-1.5 align-top font-mono whitespace-pre-wrap text-text">
      {text}
    </code>
  )
}

/**
 * What happened on one test case, on one compact line (it wraps on narrow screens): the error that
 * stopped the program, or its output next to the expected one and the first line that differs.
 * `action` goes at the end of the line ("Run with this input").
 */
function CaseDetails({ result, action }: { result: CaseResult; action?: ReactNode }) {
  const { t, phrase } = useTranslation()
  const { error } = result

  return (
    <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-body-sm text-text">
      {error ? (
        <span>
          <span className="font-semibold">
            {error instanceof UnsupportedConstructError
              ? t('error.unsupported', { construct: phrase(error.construct) })
              : t('error.codeError')}{' '}
            · {t('error.line', { line: error.line })}:
          </span>{' '}
          {phrase(error.text)}
        </span>
      ) : (
        <>
          <span>
            {t('check.yourOutput')}: <InlineOutput output={result.actualOutput ?? ''} />
          </span>
          <span>
            {t('check.expectedOutput')}: <InlineOutput output={result.expectedOutput} />
          </span>
          {result.differentLine !== null && (
            <span className="text-textMuted">{t('check.differentLine', { line: result.differentLine })}</span>
          )}
        </>
      )}
      {action}
    </p>
  )
}

/**
 * The open problem, above the Playground's editor and Execution panels: its statement, the Check button
 * and what the last Check found. Run and the step controls below work exactly as in the Playground.
 */
type ProblemPanelProps = {
  problem: Problem
  /** Puts a test case's input into the Input field and presses Run, so a failed case can be stepped through. */
  onRunWithInput: (input: string) => void
}

function ProblemPanel({ problem, onRunWithInput }: ProblemPanelProps) {
  const code = usePlaygroundStore((state) => state.code)
  const checkResult = usePlaygroundStore((state) => state.checkResult)
  const checkedCode = usePlaygroundStore((state) => state.checkedCode)
  const newBadges = usePlaygroundStore((state) => state.newBadges)
  const check = usePlaygroundStore((state) => state.check)
  const setTab = usePlaygroundStore((state) => state.setTab)
  const { t, locale } = useTranslation()

  // Same marking as a stale trace: a dashed outline, the text keeps its colors.
  const isStale = checkResult !== null && code !== checkedCode

  function headline(result: CheckResult): string {
    const { cases } = result
    const failed = cases.filter((testCase) => !testCase.passed)
    if (cases.length > 1 && sameErrorEverywhere(result)) return t('check.error')
    if (cases.length > 1) {
      return result.passed
        ? t('check.passedAll', { total: cases.length })
        : t('check.passedSome', { passed: cases.length - failed.length, total: cases.length })
    }
    // One case: "stopped with an error" when it never got to print a full answer, "printed something different" otherwise.
    if (result.passed) return t('check.passed')
    return failed[0].error ? t('check.error') : t('check.failed')
  }

  /**
   * "Run with this input", for a failed case that has input: the student can watch the trace for the
   * input that broke their program without typing it in. Not shown for a passed case or a problem without scanf.
   * A small link-style action at the end of the case's line; its 44px touch area overlaps the lines around
   * it (-my-3) so the row stays compact. The accessible name says which input, and contains the visible "Run".
   */
  function runWithInputAction(testCase: CaseResult) {
    if (testCase.passed || testCase.input === '') return null
    return (
      <button
        type="button"
        onClick={() => onRunWithInput(testCase.input)}
        aria-label={t('check.runWithInput')}
        title={t('check.runWithInput')}
        className="-my-3 inline-flex min-h-11 items-center gap-1 rounded-control px-1.5 font-semibold text-accentText hover:underline focus-visible:outline-2 focus-visible:outline-accent"
      >
        <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
          <path d="M3 2v8l7-4z" fill="currentColor" />
        </svg>
        {t('button.run')}
      </button>
    )
  }

  /**
   * One row per test case: passed or failed, with the input it got. A failed case adds a second line with
   * what went wrong. Rows sit on the plain panel, told apart by their icon and words; only the summary
   * line above them is tinted.
   */
  function caseList(result: CheckResult) {
    return (
      <ol className="flex flex-col divide-y divide-border">
        {result.cases.map((testCase, index) => (
          <li key={index} className="flex flex-col gap-1 py-2 first:pt-0 last:pb-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-text">
              <ResultIcon passed={testCase.passed} />
              <span className="font-semibold">
                {t(testCase.passed ? 'check.casePassed' : 'check.caseFailed', { number: index + 1 })}
              </span>
              {testCase.input !== '' && (
                <span>
                  · {t('editor.input')}: <code className="font-mono">{testCase.input}</code>
                </span>
              )}
            </p>
            {/* pl-6: lined up under the case's label, past the icon. */}
            {!testCase.passed && (
              <div className="pl-6">
                <CaseDetails result={testCase} action={runWithInputAction(testCase)} />
              </div>
            )}
          </li>
        ))}
      </ol>
    )
  }

  return (
    <section className="rounded-panel border border-border bg-panel">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4.5 py-3.5">
        <div className="flex min-w-0 flex-wrap items-center gap-2.5">
          <Button variant="secondary" onClick={() => setTab('problems')}>
            ← {t('problem.allProblems')}
          </Button>
          <h2 className="text-body-md font-semibold">{problem.title[locale]}</h2>
          <ProblemKindBadge kind={problem.kind} />
          <DifficultyBadge difficulty={problem.difficulty} />
          <Chip>{t(`problems.topic.${problem.topic}`)}</Chip>
        </div>
        <Button onClick={check}>{t('button.check')}</Button>
      </header>

      <div className="flex flex-col gap-4 p-4.5">
        <div>
          <h3 className="mb-1.75 text-label text-textMuted">{t('problem.task')}</h3>
          <StatementText text={problem.statement[locale]} className="text-body-md text-text" />
          {/* The link's 44px touch area overlaps the lines around it (-my-3), like "Run with this input". */}
          <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-body-sm text-textMuted">
            {t('problem.question')}
            <a
              href={TELEGRAM_GROUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="-my-3 inline-flex min-h-11 items-center gap-1 rounded-control font-semibold text-accentText hover:underline focus-visible:outline-2 focus-visible:outline-accent"
            >
              {t('problem.askTelegram')}
              <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3">
                <path d="M4.5 2.5h5v5M9.5 2.5 3 9" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="sr-only">{t('link.newTab')}</span>
            </a>
          </p>
        </div>

        {isStale && (
          <p
            role="status"
            className="rounded-container border border-dashed border-textMuted bg-surface px-3.5 py-3 text-body-md text-text"
          >
            {t('check.stale')}
          </p>
        )}

        {checkResult && (
          <div
            role="status"
            className={`flex flex-col gap-3 rounded-container border border-border p-3 ${
              isStale ? 'outline-2 outline-offset-4 outline-dashed outline-textMuted' : ''
            }`}
          >
            {/* The summary line is the only tinted part, green or red. */}
            <p
              className={`flex items-center gap-2 rounded-control border px-3 py-2 text-body-md font-semibold text-text ${
                checkResult.passed ? 'border-success bg-successTint' : 'border-error bg-errorTint'
              }`}
            >
              <ResultIcon passed={checkResult.passed} />
              {headline(checkResult)}
            </p>

            {/* The same error on every case doesn't depend on the input: shown once, with no "Run with this input". */}
            {sameErrorEverywhere(checkResult) ? (
              <CaseDetails result={checkResult.cases[0]} />
            ) : checkResult.cases.length === 1 ? (
              <CaseDetails result={checkResult.cases[0]} action={runWithInputAction(checkResult.cases[0])} />
            ) : (
              caseList(checkResult)
            )}

            {!checkResult.passed && <p className="text-body-sm text-textMuted">{t('check.hint')}</p>}

            {/* Shown on the Check that unlocked a badge only; the Problems section's shelf lists them all. */}
            {newBadges.map((id) => (
              <div key={id} className="flex items-center gap-3 border-t border-border pt-3">
                <BadgeIcon id={id} unlocked />
                <div className="flex flex-col">
                  <span className="text-body-md font-semibold text-text">
                    {t('badges.new', { name: t(`badge.${id}.title`) })}
                  </span>
                  <span className="text-body-sm text-textMuted">{t('badges.deviceOnly')}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

export default ProblemPanel
