import { useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { AUTOPLAY_DELAY_MS } from '../../constants/playback'
import { usePlaygroundStore } from '../../store/playgroundStore'
import EditorPanel from './EditorPanel'
import ExecutionPanel from './ExecutionPanel'

function PlaygroundScreen() {
  const isPlaying = usePlaygroundStore((state) => state.isPlaying)
  const stepIndex = usePlaygroundStore((state) => state.stepIndex)
  const next = usePlaygroundStore((state) => state.next)
  const run = usePlaygroundStore((state) => state.run)
  const layoutRef = useRef<HTMLDivElement>(null)
  const executionRef = useRef<HTMLElement>(null)
  const reduceMotion = useReducedMotion()

  // Auto Play: move one step forward after a short pause, until the store stops playing.
  useEffect(() => {
    if (!isPlaying) return
    const timer = setTimeout(next, AUTOPLAY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isPlaying, stepIndex, next])

  function handleRun() {
    run()
    // On narrow screens the panels stack (flex-col below the min-[1000px] breakpoint), so the
    // Execution panel sits under the editor. Bring it into view so Run visibly does something.
    const layout = layoutRef.current
    if (layout && getComputedStyle(layout).flexDirection === 'column') {
      executionRef.current?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    }
  }

  return (
    <div ref={layoutRef} className="flex flex-col gap-5 min-[1000px]:flex-row">
      <EditorPanel onRun={handleRun} />
      <ExecutionPanel ref={executionRef} />
    </div>
  )
}

export default PlaygroundScreen
