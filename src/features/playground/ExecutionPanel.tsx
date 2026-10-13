import { motion, useReducedMotion } from 'framer-motion'
import type { Ref } from 'react'
import Button from '../../components/Button'
import MaximizeButton from '../../components/MaximizeButton'
import ProgressBar from '../../components/ProgressBar'
import { UnsupportedConstructError } from '../../engine/errors'
import type { PhrasePart } from '../../i18n/formatPhrase'
import { useTranslation } from '../../i18n/useTranslation'
import { useCurrentExample, usePlaygroundStore } from '../../store/playgroundStore'
import ArrayVisualizer from './ArrayVisualizer'
import ConsolePanel from './ConsolePanel'
import LoopTracker from './LoopTracker'
import SpeedControl from './SpeedControl'
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
  const { t, phrase, phraseParts } = useTranslation()

  const step = example.steps[stepIndex]
  const totalSteps = example.steps.length
  const isLastStep = stepIndex === totalSteps - 1
  const stepKey = `${example.id}-${stepIndex}`
  // Framer's reducedMotion="user" still fades opacity/colors, so skip these animations ourselves
  const reduceMotion = useReducedMotion()
  // text-explanation follows the reader's A− / A+ choice (settingsStore)
  const explanationClass = 'rounded-container border border-border bg-surface px-4.5 py-4 text-explanation text-text'

  return (
    <section
      ref={ref}
      className={`flex min-w-0 flex-1 scroll-mt-4 flex-col rounded-panel border border-border bg-panel ${className}`}
    >
      <header className="flex h-11.75 items-center justify-between border-b border-border px-4.5">
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

      <div className="flex flex-col gap-4.5 p-4.5">
        {/* The speed picker wraps onto its own line when the panel is too narrow for all four */}
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="flex-auto" onClick={prev} disabled={stepIndex === 0}>
            {t('button.previous')}
          </Button>
          <Button variant="secondary" className="flex-auto" onClick={toggleAutoplay}>
            {isPlaying ? t('button.pause') : t('button.autoPlay')}
          </Button>
          <Button className="flex-auto" onClick={next} disabled={isLastStep}>
            {t('button.next')}
          </Button>
          <SpeedControl />
        </div>

        <ProgressBar value={(stepIndex + 1) / totalSteps} />

        <VariablesPanel variables={step.variables} changed={step.changed} stepKey={stepKey} />

        {/* The last Run failed: say where and why. The previous trace stays below. */}
        {runError && (
          <div role="alert" className="rounded-container border border-error bg-errorTint px-3.5 py-3 text-body-md">
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

        {step.loop && <LoopTracker loop={step.loop} header={example.code[step.loop.line - 1].trim()} />}
        {step.array && <ArrayVisualizer array={step.array} />}
        <ConsolePanel output={step.output} />
      </div>
    </section>
  )
}

export default ExecutionPanel
