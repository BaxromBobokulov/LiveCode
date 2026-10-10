import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ArrayView } from '../../engine/types'

// Framer Motion animates between the same color tokens via their CSS variables
const activeColors = {
  backgroundColor: 'var(--color-accentTint)',
  borderColor: 'var(--color-accent)',
}
const inactiveColors = {
  backgroundColor: 'var(--color-white)',
  borderColor: 'var(--color-border)',
}
const transition = { duration: 0.2, ease: 'easeOut' } as const

function ArrayVisualizer({ array }: { array: ArrayView }) {
  const reduceMotion = useReducedMotion()

  // Remember which cell was active before this one, so it can fade back out
  // while the newly active cell fades in and pulses once.
  const [currentIndex, setCurrentIndex] = useState(array.activeIndex)
  const [previousIndex, setPreviousIndex] = useState<number | null>(null)
  if (array.activeIndex !== currentIndex) {
    setPreviousIndex(currentIndex)
    setCurrentIndex(array.activeIndex)
  }

  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">
        Array <span className="font-mono font-normal">{array.name}</span>
      </h3>
      <div className="flex flex-wrap gap-2">
        {array.values.map((value, index) => {
          const isActive = index === array.activeIndex
          // Only the two cells swapping the highlight animate; every other cell stays a plain div
          const isAnimated = !reduceMotion && (isActive || index === previousIndex)
          const cellClass = `flex size-12 items-center justify-center rounded-container border font-mono text-body-md text-text ${
            isActive ? 'border-accent bg-accentTint' : 'border-border bg-white'
          }`
          const labelClass = `font-mono text-caption ${isActive ? 'text-accentDark' : 'text-textFaint'}`
          return (
            <div key={index} className="flex flex-col items-center gap-1">
              {isAnimated ? (
                <>
                  <motion.div
                    initial={inactiveColors}
                    animate={
                      isActive ? { ...activeColors, scale: [1, 1.08, 1] } : { ...inactiveColors, scale: 1 }
                    }
                    transition={transition}
                    className={cellClass}
                  >
                    {value}
                  </motion.div>
                  <motion.span
                    initial={{ color: 'var(--color-textFaint)' }}
                    animate={{ color: isActive ? 'var(--color-accentDark)' : 'var(--color-textFaint)' }}
                    transition={transition}
                    className={labelClass}
                  >
                    [{index}]
                  </motion.span>
                </>
              ) : (
                <>
                  <div className={cellClass}>{value}</div>
                  <span className={labelClass}>[{index}]</span>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ArrayVisualizer
