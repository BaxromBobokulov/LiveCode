import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, type RefObject } from 'react'
import { CHANGE_SCROLL_DURATION_S } from '../../constants/playback'
import { changeScrollTarget, isNearFollowed, spanToShow } from './followLine'

/**
 * Keeps a step's changed variable or highlighted array cell (each marked `data-step-change`) in view,
 * by scrolling only `regionRef`, the scrolling part of the Execution panel: scrollIntoView would move
 * the page too. It scrolls only when the change is out of view, and only if the student is still where
 * it last left the area: if not, they have scrolled away to read something, like the Console, so they
 * are left there, also when they press Next. Following picks up again when they scroll back there, or
 * from a new Run or Reset. Stacked, the area has nothing to scroll, so this does nothing.
 */
export function useFollowChange(
  regionRef: RefObject<HTMLDivElement | null>,
  stepKey: string,
  stepIndex: number,
  traceStale: boolean,
) {
  const reduceMotion = useReducedMotion()
  const followedTop = useRef(0)
  const scrolledAway = useRef(false)
  const lastTop = useRef(0)
  const stopScroll = useRef<(() => void) | null>(null)

  useEffect(() => {
    const region = regionRef.current
    // No height: the panel is hidden, while the editor is maximized.
    if (!region || region.clientHeight === 0 || traceStale) return
    // A step during the animation starts from where it was going, so it isn't mistaken for the student's scroll.
    if (stopScroll.current) {
      stopScroll.current()
      region.scrollTop = followedTop.current
    }
    // Back at the start (a new Run, Reset): wherever the student was reading, this is a new trace.
    if (stepIndex === 0) {
      followedTop.current = region.scrollTop
      scrolledAway.current = false
    }

    const box = region.getBoundingClientRect()
    const { scrollTop } = region
    const maxScrollTop = region.scrollHeight - region.clientHeight
    // The area can get shorter on its own (a loop's tracker going, a call swapping the Variables), which moves
    // scrollTop too. That carries a following student along, and must not count as a student who scrolled away coming back.
    if (!scrolledAway.current) followedTop.current = Math.min(followedTop.current, maxScrollTop)
    // Checked on every step, so the steps with nothing to follow count too. Coming back takes scrolling: a
    // student sitting still doesn't return because the Console grew and they are no longer at the very end.
    if (!scrolledAway.current || Math.abs(scrollTop - lastTop.current) > 1) {
      scrolledAway.current = !isNearFollowed(scrollTop, followedTop.current, maxScrollTop)
    }
    lastTop.current = scrollTop

    const toSpan = (top: number, bottom: number) => ({
      top: top - box.top + scrollTop,
      bottom: bottom - box.top + scrollTop,
    })
    const items = [...region.querySelectorAll('[data-step-change]')].map((item) => {
      const rect = item.getBoundingClientRect()
      return toSpan(rect.top, rect.bottom)
    })
    if (items.length === 0) return

    // Until the page has scrolled, the bottom of the panel is below the window, so that part can't be seen.
    const view = toSpan(Math.max(box.top, 0), Math.min(box.bottom, window.innerHeight))
    const span = spanToShow(items, view.bottom - view.top)
    const target = changeScrollTarget(span, view, scrollTop, maxScrollTop)
    if (target === null || scrolledAway.current) return
    followedTop.current = target

    if (reduceMotion) {
      region.scrollTop = target
      return
    }
    const cancel = () => {
      controls.stop()
      region.removeEventListener('wheel', cancel)
      region.removeEventListener('touchstart', cancel)
      stopScroll.current = null
    }
    const controls = animate(scrollTop, target, {
      duration: CHANGE_SCROLL_DURATION_S,
      ease: 'easeOut',
      onUpdate: (y) => {
        region.scrollTop = y
      },
      onComplete: () => cancel(),
    })
    stopScroll.current = cancel
    // The wheel or a finger on this area takes over from the animation.
    region.addEventListener('wheel', cancel, { passive: true })
    region.addEventListener('touchstart', cancel, { passive: true })
  }, [stepKey, stepIndex, traceStale, reduceMotion, regionRef])
}
