import { motion, useReducedMotion } from 'framer-motion'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { Variable } from '../../engine/types'
import { useTranslation } from '../../i18n/useTranslation'

type VariablesPanelProps = {
  variables: Variable[]
  changed: string[]
  /** Unique per step, so a changed value pops in again even if the step comes quickly after the last one. */
  stepKey: string
}

/** One pointer arrow: from the pointer's box to the box of the variable it points to. */
type Arrow = { pointer: string; path: string; start: { x: number; y: number } }

/** How far an arrow between two boxes in the same row dips below them, in px. */
const ARC_DEPTH = 18

/**
 * The arrow's path between two boxes, in the container's coordinates. Boxes in the same row are joined
 * by a curve under them (in the row gap); otherwise the curve runs from one box's edge to the other's.
 */
function arrowPath(from: DOMRect, to: DOMRect, container: DOMRect): Arrow['path'] {
  const sx = from.left + from.width / 2 - container.left
  const tx = to.left + to.width / 2 - container.left
  if (Math.abs(from.top - to.top) < 4) {
    const y = from.bottom - container.top
    return `M ${sx} ${y} C ${sx} ${y + ARC_DEPTH}, ${tx} ${y + ARC_DEPTH}, ${tx} ${y}`
  }
  const down = to.top > from.top
  const sy = (down ? from.bottom : from.top) - container.top
  const ty = (down ? to.top : to.bottom) - container.top
  const bend = down ? ARC_DEPTH : -ARC_DEPTH
  return `M ${sx} ${sy} C ${sx} ${sy + bend}, ${tx} ${ty - bend}, ${tx} ${ty}`
}

/** The name of the variable at `address`, if it is shown. */
function nameAt(variables: Variable[], address: string): string | undefined {
  return variables.find((variable) => variable.address === address)?.name
}

function VariablesPanel({ variables, changed, stepKey }: VariablesPanelProps) {
  const reduceMotion = useReducedMotion()
  const { t } = useTranslation()
  const markerId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  // Each variable's box, by name, so the arrows can be measured from the real layout.
  const boxRefs = useRef(new Map<string, HTMLDivElement>())
  const [arrows, setArrows] = useState<Arrow[]>([])

  // Programs with pointers show every variable's address, and leave room between rows for the arrows.
  const showsAddresses = variables.some((variable) => variable.address)

  // Arrows depend on where the boxes ended up, so they are measured after layout and again on resize.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return
    function measure() {
      const containerRect = container!.getBoundingClientRect()
      const next: Arrow[] = []
      for (const variable of variables) {
        const targetName = variable.pointsTo && nameAt(variables, variable.pointsTo)
        const from = boxRefs.current.get(variable.name)
        const to = targetName ? boxRefs.current.get(targetName) : undefined
        if (!from || !to) continue
        const path = arrowPath(from.getBoundingClientRect(), to.getBoundingClientRect(), containerRect)
        const [x, y] = path.split(' ').slice(1, 3).map(Number)
        next.push({ pointer: variable.name, path, start: { x, y } })
      }
      setArrows(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    return () => observer.disconnect()
  }, [variables])

  return (
    <div>
      <h3 className="mb-1.75 text-label text-textMuted">{t('panel.variables')}</h3>
      <div
        ref={containerRef}
        className={`relative flex flex-wrap ${showsAddresses ? 'gap-x-2 gap-y-6 pb-5' : 'gap-2'}`}
      >
        {variables.map((variable) => {
          const isChanged = changed.includes(variable.name)
          const valueClass = 'origin-left font-mono text-body-md leading-5 text-text'
          const captionClass = `font-mono text-caption ${isChanged ? 'text-textMutedOnTint' : 'text-textMuted'}`
          const targetName = variable.pointsTo ? nameAt(variables, variable.pointsTo) : undefined
          return (
            <div
              key={variable.name}
              ref={(element) => {
                if (element) boxRefs.current.set(variable.name, element)
                else boxRefs.current.delete(variable.name)
              }}
              className={`min-w-30 flex-auto rounded-container border px-2.75 py-2 transition-colors duration-200 motion-reduce:transition-none ${
                isChanged ? 'border-accent bg-accentTint' : 'border-border bg-panel'
              }`}
            >
              <div className={`flex justify-between gap-2 ${captionClass}`}>
                <span>{variable.name}</span>
                {variable.address && <span>{variable.address}</span>}
              </div>
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
              {variable.isPointer && (
                <div className={captionClass}>
                  {targetName ? (
                    <>
                      <span aria-hidden="true">→ {targetName}</span>
                      <span className="sr-only">{t('variables.pointsTo', { name: targetName })}</span>
                    </>
                  ) : (
                    variable.value === 'NULL' && t('variables.pointsToNothing')
                  )}
                </div>
              )}
            </div>
          )
        })}

        {arrows.length > 0 && (
          <svg aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible">
            <defs>
              <marker
                id={markerId}
                viewBox="0 0 8 8"
                refX="7"
                refY="4"
                markerWidth="8"
                markerHeight="8"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M 0 0 L 8 4 L 0 8 z" className="fill-accent" />
              </marker>
            </defs>
            {arrows.map((arrow) => {
              const props = { d: arrow.path, markerEnd: `url(#${markerId})`, className: 'fill-none stroke-accent stroke-[1.5]' }
              // A pointer that was just given a new address draws its arrow in.
              const animate = changed.includes(arrow.pointer) && !reduceMotion
              return (
                <g key={arrow.pointer}>
                  <circle cx={arrow.start.x} cy={arrow.start.y} r="3" className="fill-accent" />
                  {animate ? (
                    <motion.path
                      key={stepKey}
                      {...props}
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                    />
                  ) : (
                    <path {...props} />
                  )}
                </g>
              )
            })}
          </svg>
        )}
      </div>
    </div>
  )
}

export default VariablesPanel
