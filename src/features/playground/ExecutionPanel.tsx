import { motion } from 'framer-motion'
import Button from '../../components/Button'
import ProgressBar from '../../components/ProgressBar'
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

  const step = example.steps[stepIndex]
  const totalSteps = example.steps.length
  const isLastStep = stepIndex === totalSteps - 1

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

        <VariablesPanel variables={step.variables} changed={step.changed} />

        <motion.p
          key={`${example.id}-${stepIndex}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.15 }}
          aria-live="polite"
          className="rounded-container border border-border bg-surface px-3.5 py-3 text-body-md text-text"
        >
          {step.explanation}
        </motion.p>

        {step.loop && <LoopTracker loop={step.loop} header={example.code[step.loop.line - 1].trim()} />}
        {step.array && <ArrayVisualizer array={step.array} />}
        <ConsolePanel output={step.output} />
      </div>
    </section>
  )
}

export default ExecutionPanel
