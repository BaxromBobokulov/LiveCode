import { motion, useReducedMotion } from 'framer-motion'
import { useRef, type Ref } from 'react'
import Button from '../../components/Button'
import MaximizeButton from '../../components/MaximizeButton'
import ProgressBar from '../../components/ProgressBar'
import { UnsupportedConstructError } from '../../engine/errors'
import type { PhrasePart } from '../../i18n/formatPhrase'
import { useTranslation } from '../../i18n/useTranslation'
import { useCurrentExample, usePlaygroundStore, useStaleness } from '../../store/playgroundStore'
import ArrayVisualizer from './ArrayVisualizer'
import ConsolePanel from './ConsolePanel'
import LoopTracker from './LoopTracker'
import SpeedControl from './SpeedControl'
import { useFollowChange } from './useFollowChange'
import VariablesPanel from './VariablesPanel'

type ExecutionPanelProps = {
  ref?: Ref<HTMLElement>
  /** Whether this panel is expanded to the full width; `onToggleMaximize` flips it. */
  isMaximized: boolean
  onToggleMaximize: () => void
  /** Sizing from PlaygroundScreen (the resizable split). */
  className?: string
}

/** A translated sentence with its code tokens (names, numbers, expressions) in the mono font, so they stand out from the prose. */
function PhraseText({ parts }: { parts: PhrasePart[] }) {
  return parts.map((part, i) =>
    typeof part === 'string' ? (
      part
    ) : (
      <code
        key={i}
        className="rounded-control bg-accentTint px-1 py-0.5 font-mono text-accentText box-decoration-clone"
      >
        {part.code}
      </code>
    ),
  )
}

function ExecutionPanel({ ref, isMaximized, onToggleMaximize, className = '' }: ExecutionPanelProps) {
  const example = useCurrentExample()
  const stepIndex = usePlaygroundStore((state) => state.stepIndex)
  const isPlaying = usePlaygroundStore((state) => state.isPlaying)
  const next = usePlaygroundStore((state) => state.next)
  const prev = usePlaygroundStore((state) => state.prev)
  const toggleAutoplay = usePlaygroundStore((state) => state.toggleAutoplay)
  const runError = usePlaygroundStore((state) => state.runError)
  const { traceStale, errorStale } = useStaleness()
  const { t, phrase, phraseParts } = useTranslation()

  const step = example.steps[stepIndex]
  const totalSteps = example.steps.length
  const isLastStep = stepIndex === totalSteps - 1
  const stepKey = `${example.id}-${stepIndex}`
  const regionRef = useRef<HTMLDivElement>(null)
  useFollowChange(regionRef, stepKey, stepIndex, traceStale)
  // Framer's reducedMotion="user" still fades opacity/colors, so skip these animations ourselves
  const reduceMotion = useReducedMotion()
  // text-explanation follows the reader's A− / A+ choice (settingsStore). Room for two lines of it plus the
  // padding and border, so Variables below don't jump each time a step's explanation changes between 1 and 2 lines.
  const explanationClass =
    'min-h-[calc(2lh+2rem+2px)] rounded-container border border-border bg-surface px-4.5 py-4 text-explanation text-text'
  // Out of date with the code (see `staleness`): a dashed textMuted outline marks it until the next Run.
  // The text keeps its own colors, so every contrast pair inside stays as verified; the outline is
  // 4.97:1 (light) / 7.54:1 (dark) on the panel, over the 3:1 needed for a graphic.
  const staleOutline = 'rounded-container outline-2 outline-offset-4 outline-dashed outline-textMuted'
  const traceClass = `flex flex-col gap-4.5 ${traceStale ? staleOutline : ''}`
  // Shown while the thing on screen (the error box if there is one, the trace otherwise) is out of date.
  const showStaleNote = runError ? errorStale : traceStale

  return (
    // Side by side, the panel stays on screen while the page scrolls the code. It stops 2.5rem short of the
    // screen height: 1rem above it (top-4) and the 1.5rem of padding under it (main's py-6), so it stays stuck
    // all the way to the end of the page. Stretched by the row, so a short program's panels still end level.
    <section
      ref={ref}
      className={`flex min-w-0 flex-1 scroll-mt-4 flex-col rounded-panel border border-border bg-panel min-[1000px]:sticky min-[1000px]:top-4 min-[1000px]:max-h-[calc(100dvh-2.5rem)] ${className}`}
    >
      <header className="flex h-11.75 shrink-0 items-center justify-between border-b border-border px-4.5">
        <h2 className="text-body-md font-semibold">{t('panel.execution')}</h2>
        <div className="flex items-center gap-3">
          <span className="text-body-sm font-semibold text-textMuted">
            {t('execution.stepOf', { current: stepIndex + 1, total: totalSteps })}
          </span>
          <MaximizeButton
            isMaximized={isMaximized}
            label={isMaximized ? t('layout.restore') : t('layout.expandExecution')}
            onClick={onToggleMaximize}
          />
        </div>
      </header>

      {/* Pinned: what a student needs on every step. Side by side, Variables and the rest scroll under it.
          Its height limit only matters on a short window with a long error, so the part below always gets some room. */}
      <div className="flex shrink-0 flex-col gap-4.5 p-4.5 pb-0 min-[1000px]:max-h-[70dvh] min-[1000px]:overflow-y-auto min-[1000px]:border-b min-[1000px]:border-border min-[1000px]:pb-4.5">
        {/* The speed picker wraps onto its own line when the panel is too narrow for all four */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="flex-auto" onClick={prev} disabled={traceStale || stepIndex === 0}>
            {t('button.previous')}
          </Button>
          <Button variant="secondary" className="flex-auto" onClick={toggleAutoplay} disabled={traceStale}>
            {isPlaying ? t('button.pause') : t('button.autoPlay')}
          </Button>
          <Button className="flex-auto" onClick={next} disabled={traceStale || isLastStep}>
            {t('button.next')}
          </Button>
          <SpeedControl />
        </div>

        {showStaleNote && (
          <p
            role="status"
            className="rounded-container border border-dashed border-textMuted bg-surface px-3.5 py-3 text-body-md text-text"
          >
            {t('execution.stale')}
          </p>
        )}

        {/* The last Run failed: say where and why. The previous trace stays below. */}
        {runError && (
          <div
            role="alert"
            className={`rounded-container border border-error bg-errorTint px-3.5 py-3 text-body-md ${
              errorStale ? staleOutline : ''
            }`}
          >
            <p className="font-semibold text-error">
              {runError instanceof UnsupportedConstructError
                ? t('error.unsupported', { construct: phrase(runError.construct) })
                : t('error.codeError')}
              <span className="font-normal"> · {t('error.line', { line: runError.line })}</span>
            </p>
            <p className="mt-1 text-textMuted">
              <PhraseText parts={phraseParts(runError.text)} />
            </p>
          </div>
        )}

        <div className={traceClass}>
          <ProgressBar value={(stepIndex + 1) / totalSteps} />
          {reduceMotion ? (
            <p aria-live="polite" className={explanationClass}>
              <PhraseText parts={phraseParts(step.explanation)} />
            </p>
          ) : (
            // A new key each step remounts the box, so a fast step replaces the fade instead of queuing behind it
            <motion.p
              key={stepKey}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              aria-live="polite"
              className={explanationClass}
            >
              <PhraseText parts={phraseParts(step.explanation)} />
            </motion.p>
          )}
        </div>
      </div>

      {/* tabIndex: a scrolling area has to be reachable from the keyboard. */}
      <div
        ref={regionRef}
        tabIndex={0}
        role="region"
        aria-label={t('panel.executionDetails')}
        className="min-h-0 flex-1 p-4.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent min-[1000px]:overflow-y-auto"
      >
        <div className={traceClass}>
          <VariablesPanel variables={step.variables} changed={step.changed} stepKey={stepKey} />
          {step.loop && <LoopTracker loop={step.loop} header={example.code[step.loop.line - 1].trim()} />}
          {step.array && <ArrayVisualizer array={step.array} />}
          <ConsolePanel output={step.output} isNew={stepIndex > 0 && step.output !== example.steps[stepIndex - 1].output} />
        </div>
      </div>
    </section>
  )
}

export default ExecutionPanel
