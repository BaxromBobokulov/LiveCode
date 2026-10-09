import { motion } from 'framer-motion'
import type { Variable } from '../../engine/types'

type VariablesPanelProps = {
  variables: Variable[]
  changed: string[]
}

function VariablesPanel({ variables, changed }: VariablesPanelProps) {
  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">Variables</h3>
      <div className="flex flex-wrap gap-2">
        {variables.map((variable) => {
          const isChanged = changed.includes(variable.name)
          return (
            <div
              key={variable.name}
              className={`min-w-30 flex-auto rounded-container border px-2.75 py-2 transition-colors duration-200 motion-reduce:transition-none ${
                isChanged ? 'border-accent bg-accentTint' : 'border-border bg-white'
              }`}
            >
              <div className="font-mono text-caption text-textMuted">{variable.name}</div>
              {/* Keyed by value so the new value pops in whenever it changes */}
              <motion.div
                key={variable.value}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="origin-left font-mono text-body-md leading-5 text-text"
              >
                {variable.value}
              </motion.div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default VariablesPanel
