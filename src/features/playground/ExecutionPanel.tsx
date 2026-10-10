import { motion, useReducedMotion } from 'framer-motion'
import Button from '../../components/Button'
import ProgressBar from '../../components/ProgressBar'
import { UnsupportedConstructError } from '../../engine/errors'
import { useCurrentExample, usePlaygroundStore } from '../../store/playgroundStore'
import ArrayVisualizer from './ArrayVisualizer'
import ConsolePanel from './ConsolePanel'
import LoopTracker from './LoopTracker'
import VariablesPanel from './VariablesPanel'

function ExecutionPanel() {
  const example = useCurrentExample()
  const stepIndex = usePlaygroundStore((state) => state.stepIndex)
  const isPlaying = usePlaygroundStore((state) => state.isPlaying)
  const next = usePlaygroundStore((state) => state.next)
  const prev = usePlaygroundStore((state) => state.prev)
  const toggleAutoplay = usePlaygroundStore((state) => state.toggleAutoplay)
  const runError = usePlaygroundStore((state) => state.runError)

  const step = example.steps[stepIndex]
  const totalSteps = example.steps.length
  const isLastStep = stepIndex === totalSteps - 1
  const stepKey = `${example.id}-${stepIndex}`
  // Framer's reducedMotion="user" still fades opacity/colors, so skip these animations ourselves
  const reduceMotion = useReducedMotion()
  const explanationClass = 'rounded-container border border-border bg-surface px-3.5 py-3 text-body-md text-text'

  return (
    <section className="min-w-0 flex-1 rounded-panel border border-border bg-white">
      <header className="flex h-11.75 items-center justify-between border-b border-border px-4.5">
        <h2 className="text-body-md font-semibold">Execution</h2>
        <span className="text-body-sm font-semibold text-textMuted">
          Step {stepIndex + 1} of {totalSteps}
        </span>
      </header>

      <div className="flex flex-col gap-4.5 p-4.5">
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-auto" onClick={prev} disabled={stepIndex === 0}>
            Previous
          </Button>
          <Button variant="secondary" className="flex-auto" onClick={toggleAutoplay}>
            {isPlaying ? 'Pause' : 'Auto Play'}
          </Button>
          <Button className="flex-auto" onClick={next} disabled={isLastStep}>
            Next
          </Button>
        </div>

        <ProgressBar value={(stepIndex + 1) / totalSteps} />

        <VariablesPanel variables={step.variables} changed={step.changed} stepKey={stepKey} />

        {/* The last Run failed: say where and why. The previous trace stays below. */}
        {runError && (
          <div role="alert" className="rounded-container border border-error bg-errorTint px-3.5 py-3 text-body-md">
            <p className="font-semibold text-error">
              {runError instanceof UnsupportedConstructError
                ? `Not supported yet: ${runError.construct}`
                : 'There is a problem in your code'}
              <span className="font-normal"> · line {runError.line}</span>
            </p>
            <p className="mt-1 text-textMuted">{runError.message}</p>
          </div>
        )}

        {reduceMotion ? (
          <p aria-live="polite" className={explanationClass}>
            {step.explanation}
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
            {step.explanation}
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
