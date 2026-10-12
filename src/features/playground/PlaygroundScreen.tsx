import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { AUTOPLAY_DELAY_MS, RUN_SCROLL_DELAY_MS, RUN_SCROLL_DURATION_S } from '../../constants/playback'
import { usePlaygroundStore } from '../../store/playgroundStore'
import EditorPanel from './EditorPanel'
import ExecutionPanel from './ExecutionPanel'

/**
 * After a short pause, scrolls the page so `panel` sits at the top (minus its scroll-margin),
 * easing out so it starts quickly and settles gently. Returns a function that cancels it.
 */
function scrollToPanel(panel: HTMLElement): () => void {
  let controls: ReturnType<typeof animate> | null = null

  const cancel = () => {
    clearTimeout(timer)
    controls?.stop()
    window.removeEventListener('wheel', cancel)
    window.removeEventListener('touchstart', cancel)
  }

  const timer = setTimeout(() => {
    // Measured now, after the Run result has rendered, so the target is where the panel really is.
    const margin = parseFloat(getComputedStyle(panel).scrollMarginTop) || 0
    const maxY = document.documentElement.scrollHeight - window.innerHeight
    const target = Math.min(window.scrollY + panel.getBoundingClientRect().top - margin, maxY)
    controls = animate(window.scrollY, target, {
      duration: RUN_SCROLL_DURATION_S,
      ease: [0.22, 1, 0.36, 1], // ease-out
      onUpdate: (y) => window.scrollTo(0, y),
      onComplete: cancel,
    })
  }, RUN_SCROLL_DELAY_MS)

  // A finger or the mouse wheel on the page takes over from the animation.
  window.addEventListener('wheel', cancel, { passive: true })
  window.addEventListener('touchstart', cancel, { passive: true })
  return cancel
}

function PlaygroundScreen() {
  const isPlaying = usePlaygroundStore((state) => state.isPlaying)
  const stepIndex = usePlaygroundStore((state) => state.stepIndex)
  const next = usePlaygroundStore((state) => state.next)
  const run = usePlaygroundStore((state) => state.run)
  const layoutRef = useRef<HTMLDivElement>(null)
  const executionRef = useRef<HTMLElement>(null)
  const cancelScroll = useRef<(() => void) | null>(null)
  const reduceMotion = useReducedMotion()

  // Auto Play: move one step forward after a short pause, until the store stops playing.
  useEffect(() => {
    if (!isPlaying) return
    const timer = setTimeout(next, AUTOPLAY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isPlaying, stepIndex, next])

  // Leaving the Playground stops a scroll that hasn't finished.
  useEffect(() => () => cancelScroll.current?.(), [])

  function handleRun() {
    run()
    cancelScroll.current?.()
    // On narrow screens the panels stack (flex-col below the min-[1000px] breakpoint), so the
    // Execution panel sits under the editor. Bring it into view so Run visibly does something.
    const layout = layoutRef.current
    const panel = executionRef.current
    if (!layout || !panel || getComputedStyle(layout).flexDirection !== 'column') return
    if (reduceMotion) panel.scrollIntoView({ block: 'start' })
    else cancelScroll.current = scrollToPanel(panel)
  }

  return (
    <div ref={layoutRef} className="flex flex-col gap-5 min-[1000px]:flex-row">
      <EditorPanel onRun={handleRun} />
      <ExecutionPanel ref={executionRef} />
    </div>
  )
}

export default PlaygroundScreen
