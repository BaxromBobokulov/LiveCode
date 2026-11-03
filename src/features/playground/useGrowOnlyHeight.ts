import { useLayoutEffect, useRef, type RefObject } from 'react'

/**
 * Lets `ref`'s element grow, but never shrink, while the same trace is shown, by keeping its `min-height`
 * at the tallest it has been. So a box that goes away (a loop's tracker, a function's variables after it
 * returns) or a Console that is shorter on Previous leaves room instead of pulling everything below it up,
 * and the panel doesn't change size back and forth between steps. A new trace, a new width (the boxes
 * wrap differently) or a new text size (the A− / A+ buttons) starts again from the content's own height.
 *
 * Set straight on the element in a layout effect, not through state: it is in place before the browser
 * paints and before useFollowChange measures the area, without a second render.
 */
export function useGrowOnlyHeight(ref: RefObject<HTMLElement | null>, trace: unknown, stepKey: string) {
  const tallest = useRef({ trace, width: 0, fontSize: '', height: 0 })

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return
    const width = element.offsetWidth
    const { fontSize } = getComputedStyle(element)
    const seen = tallest.current
    if (seen.trace !== trace || seen.width !== width || seen.fontSize !== fontSize) {
      element.style.minHeight = ''
      tallest.current = { trace, width, fontSize, height: 0 }
    }
    tallest.current.height = Math.max(tallest.current.height, element.offsetHeight)
    element.style.minHeight = `${tallest.current.height}px`
  }, [ref, trace, stepKey])
}
