import { Fragment, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { charText, isGridView, type ArrayView, type GridCell, type GridView } from '../../engine/types'
import { useTranslation } from '../../i18n/useTranslation'

// Framer Motion animates between the same color tokens via their CSS variables
const activeColors = {
  backgroundColor: 'var(--color-accentTint)',
  borderColor: 'var(--color-accent)',
}
const inactiveColors = {
  backgroundColor: 'var(--color-panel)',
  borderColor: 'var(--color-border)',
}
const transition = { duration: 0.2, ease: 'easeOut' } as const

/** Equal for two steps that highlight the same elements, so a new step's { row, col } object compares equal. */
function highlightKey(view: ArrayView | GridView): string {
  if (isGridView(view)) return view.activeIndex ? `${view.activeIndex.row},${view.activeIndex.col}` : ''
  return `${view.activeIndex ?? ''},${view.secondIndex ?? ''}`
}

/** Whether a 1D view highlights `index`, as its active element or as the second one (e.g. in a swap). */
function highlights(view: ArrayView | null, index: number): boolean {
  return view !== null && (view.activeIndex === index || view.secondIndex === index)
}

/** A cell's text: the number, or for a char array the character, with a space shown as ␣ so it can be seen. */
function cellText(value: number, chars: boolean): string {
  if (!chars) return String(value)
  return value === 32 ? '␣' : charText(value)
}

/** A char array's text as C reads it: every character up to the first \0. */
function textOf(values: number[]): string {
  const end = values.indexOf(0)
  return (end === -1 ? values : values.slice(0, end)).map((code) => charText(code)).join('')
}

type CellProps = {
  value: number
  /** The value is a character code, drawn as its character. */
  chars: boolean
  isActive: boolean
  /** Only the cells swapping the highlight animate; every other cell stays a plain div. */
  isAnimated: boolean
}

function ArrayCell({ value, chars, isActive, isAnimated }: CellProps) {
  // A \0 is dimmed so the text stands out, except when highlighted (muted text is too faint on the tint).
  const textColor = chars && value === 0 && !isActive ? 'text-textMuted' : 'text-text'
  const cellClass = `flex size-12 items-center justify-center rounded-container border font-mono text-body-md ${textColor} ${
    isActive ? 'border-accent bg-accentTint' : 'border-border bg-panel'
  }`
  const text = cellText(value, chars)
  if (!isAnimated) return <div className={cellClass}>{text}</div>
  return (
    <motion.div
      initial={inactiveColors}
      animate={isActive ? { ...activeColors, scale: [1, 1.08, 1] } : { ...inactiveColors, scale: 1 }}
      transition={transition}
      className={cellClass}
    >
      {text}
    </motion.div>
  )
}

/** The "[i]" under a 1D cell, or a row / column number beside a 2D grid. */
function IndexLabel({ index, isActive, isAnimated }: { index: number; isActive: boolean; isAnimated: boolean }) {
  const labelClass = `font-mono text-caption ${isActive ? 'text-accentDark' : 'text-textFaint'}`
  if (!isAnimated) return <span className={labelClass}>[{index}]</span>
  return (
    <motion.span
      initial={{ color: 'var(--color-textFaint)' }}
      animate={{ color: isActive ? 'var(--color-accentDark)' : 'var(--color-textFaint)' }}
      transition={transition}
      className={labelClass}
    >
      [{index}]
    </motion.span>
  )
}

function ArrayVisualizer({ array }: { array: ArrayView | GridView }) {
  const reduceMotion = useReducedMotion()
  const { t } = useTranslation()

  // Remember which cells were highlighted before this step, so they can fade back out
  // while the newly highlighted cells fade in and pulse once.
  const [current, setCurrent] = useState(array)
  const [previous, setPrevious] = useState<ArrayView | GridView | null>(null)
  if (highlightKey(array) !== highlightKey(current)) {
    setPrevious(current)
    setCurrent(array)
  }
  const previous1D = previous && !isGridView(previous) ? previous : null

  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">
        {t('panel.array')} <span className="font-mono font-normal">{array.name}</span>
        {/* A char array also shows the text its cells spell out, e.g. name = "hello". */}
        {array.chars && !isGridView(array) && (
          <span className="font-mono font-normal">
            {' = '}
            <span className="text-text">"{textOf(array.values)}"</span>
          </span>
        )}
      </h3>
      {isGridView(array) ? (
        <ArrayGrid grid={array} before={previous && isGridView(previous) ? previous.activeIndex : null} reduceMotion={!!reduceMotion} />
      ) : (
        <div className="flex flex-wrap gap-2">
          {array.values.map((value, index) => {
            const isActive = highlights(array, index)
            const isAnimated = !reduceMotion && (isActive || highlights(previous1D, index))
            return (
              <div key={index} className="flex flex-col items-center gap-1">
                <ArrayCell value={value} chars={!!array.chars} isActive={isActive} isAnimated={isAnimated} />
                <IndexLabel index={index} isActive={isActive} isAnimated={isAnimated} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** A 2D array laid out as rows × columns, with column numbers on top and row numbers on the left. */
function ArrayGrid({ grid, before, reduceMotion }: { grid: GridView; before: GridCell | null; reduceMotion: boolean }) {
  const active = grid.activeIndex
  const columnCount = grid.values[0].length

  return (
    <div
      className="inline-grid items-center justify-items-center gap-2"
      // The column count comes from the array's shape, so it is computed at runtime
      style={{ gridTemplateColumns: `auto repeat(${columnCount}, auto)` }}
    >
      <span />
      {grid.values[0].map((_, col) => (
        <IndexLabel
          key={col}
          index={col}
          isActive={active?.col === col}
          isAnimated={!reduceMotion && (active?.col === col || before?.col === col)}
        />
      ))}
      {grid.values.map((row, r) => (
        <Fragment key={r}>
          <IndexLabel
            index={r}
            isActive={active?.row === r}
            isAnimated={!reduceMotion && (active?.row === r || before?.row === r)}
          />
          {row.map((value, col) => {
            const isActive = active?.row === r && active.col === col
            const wasActive = before?.row === r && before.col === col
            return (
              <ArrayCell
                key={col}
                value={value}
                chars={!!grid.chars}
                isActive={isActive}
                isAnimated={!reduceMotion && (isActive || wasActive)}
              />
            )
          })}
        </Fragment>
      ))}
    </div>
  )
}

export default ArrayVisualizer
