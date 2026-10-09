import { motion } from 'framer-motion'
import type { ArrayView } from '../../engine/types'

function ArrayVisualizer({ array }: { array: ArrayView }) {
  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">
        Array <span className="font-mono font-normal">{array.name}</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {array.values.map((value, index) => {
          const isActive = index === array.activeIndex
          return (
            <div key={index} className="flex flex-col items-center gap-1">
              {/* Framer Motion animates to the same tokens via their CSS variables */}
              <motion.div
                initial={false}
                animate={{
                  backgroundColor: isActive ? 'var(--color-accentTint)' : 'var(--color-white)',
                  borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border)',
                }}
                transition={{ duration: 0.2 }}
                className="flex size-12 items-center justify-center rounded-container border font-mono text-body-md text-text"
              >
                {value}
              </motion.div>
              <span
                className={`font-mono text-caption ${isActive ? 'text-accentDark' : 'text-textFaint'}`}
              >
                [{index}]
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ArrayVisualizer
