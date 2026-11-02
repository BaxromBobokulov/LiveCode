import type { ReactCodeMirrorRef } from '@uiw/react-codemirror'
import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type RefObject } from 'react'
import { LINE_SCROLL_DURATION_S } from '../../constants/playback'
import { useCurrentExample, usePlaygroundStore, useStaleness } from '../../store/playgroundStore'
import { isLineOnScreen, lineFollowTarget } from './followLine'

/** Smoothly scrolls the page to `target`. Returns a function that cancels it. */
function scrollPageTo(target: number): () => void {
  const cancel = () => {
    controls.stop()
    window.removeEventListener('wheel', cancel)
    window.removeEventListener('touchstart', cancel)
  }
  const controls = animate(window.scrollY, target, {
    duration: LINE_SCROLL_DURATION_S,
    ease: 'easeOut',
    onUpdate: (y) => window.scrollTo(0, y),
    onComplete: () => cancel(),
  })
  // A finger or the mouse wheel on the page takes over from the animation.
  window.addEventListener('wheel', cancel, { passive: true })
  window.addEventListener('touchstart', cancel, { passive: true })
  return cancel
}

/**
 * Scrolls the page when a step puts the current code line off screen, side by side only: stacked,
 * the step buttons are under the editor, so scrolling to the line would move them away.
 * Only a new step does this, so reading elsewhere on the page between steps is left alone. During
 * Auto Play the page only keeps up with a line that was on screen until now: if it wasn't, the
 * student has scrolled away to read something, and pulling them back every step would fight them.
 */
export function useFollowCurrentLine(
  editorRef: RefObject<ReactCodeMirrorRef | null>,
  layoutRef: RefObject<HTMLDivElement | null>,
  /** Takes over from any page scroll still running; `cancel` stops this new one. */
  replaceScroll: (cancel: () => void) => void,
  editorHidden: boolean,
) {
  const example = useCurrentExample()
  const stepIndex = usePlaygroundStore((state) => state.stepIndex)
  const isPlaying = usePlaygroundStore((state) => state.isPlaying)
  const { traceStale } = useStaleness()
  const reduceMotion = useReducedMotion()
  const line = example.steps[stepIndex].line
  const lastStep = useRef(stepIndex)
  const lastLine = useRef(line)
  const wasPlaying = useRef(isPlaying)

  useEffect(() => {
    // Auto Play's last step turns isPlaying off in the same update, and it is still an Auto Play step.
    const autoPlaying = isPlaying || wasPlaying.current
    wasPlaying.current = isPlaying
    if (stepIndex === lastStep.current) return
    const previousLine = lastLine.current
    lastStep.current = stepIndex
    lastLine.current = line

    const view = editorRef.current?.view
    const layout = layoutRef.current
    if (!view || !layout || editorHidden || traceStale) return
    if (getComputedStyle(layout).flexDirection === 'column') return

    const { doc } = view.state
    const scrollY = window.scrollY
    const viewHeight = window.innerHeight
    const lineOnPage = (number: number) => {
      const block = view.lineBlockAt(doc.line(number).from)
      const lineTop = view.documentTop + scrollY + block.top
      return { lineTop, lineBottom: lineTop + block.height, scrollY, viewHeight }
    }

    // Line 0: nothing has run yet, so there is no line to show.
    if (line < 1 || line > doc.lines) return
    const hadLine = previousLine >= 1 && previousLine <= doc.lines
    if (autoPlaying && hadLine && !isLineOnScreen(lineOnPage(previousLine))) return

    const target = lineFollowTarget({
      ...lineOnPage(line),
      // Scrolled at least to the panels' top, the Execution panel is stuck and its Next button stays put.
      minY: layout.getBoundingClientRect().top + scrollY,
      maxY: document.documentElement.scrollHeight - viewHeight,
    })
    if (target === null) return

    if (reduceMotion) {
      replaceScroll(() => {})
      window.scrollTo(0, target)
    } else {
      replaceScroll(scrollPageTo(target))
    }
  }, [stepIndex, line, isPlaying, traceStale, editorHidden, reduceMotion, editorRef, layoutRef, replaceScroll])
}
