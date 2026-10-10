import { motion, useReducedMotion } from 'framer-motion'
import type { Variable } from '../../engine/types'
import { useTranslation } from '../../i18n/useTranslation'

type VariablesPanelProps = {
  variables: Variable[]
  changed: string[]
  /** Unique per step, so a changed value pops in again even if the step comes quickly after the last one. */
  stepKey: string
}

function VariablesPanel({ variables, changed, stepKey }: VariablesPanelProps) {
  const reduceMotion = useReducedMotion()
  const { t } = useTranslation()

  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">{t('panel.variables')}</h3>
      <div className="flex flex-wrap gap-2">
        {variables.map((variable) => {
          const isChanged = changed.includes(variable.name)
          const valueClass = 'origin-left font-mono text-body-md leading-5 text-text'
          return (
            <div
              key={variable.name}
              className={`min-w-30 flex-auto rounded-container border px-2.75 py-2 transition-colors duration-200 motion-reduce:transition-none ${
                isChanged ? 'border-accent bg-accentTint' : 'border-border bg-panel'
              }`}
            >
              <div className="font-mono text-caption text-textMuted">{variable.name}</div>
              {isChanged && !reduceMotion ? (
                // A new key each step remounts the value, so a new step replaces an animation that is still running
                <motion.div
                  key={stepKey}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={valueClass}
                >
                  {variable.value}
                </motion.div>
              ) : (
                <div className={valueClass}>{variable.value}</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VariablesPanel
