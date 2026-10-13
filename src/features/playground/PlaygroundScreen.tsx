import { animate, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { SPLIT_KEY_STEP, SPLIT_MAX, SPLIT_MIN } from '../../constants/layout'
import { AUTOPLAY_DELAY_MS, RUN_SCROLL_DELAY_MS, RUN_SCROLL_DURATION_S } from '../../constants/playback'
import { useTranslation } from '../../i18n/useTranslation'
import { usePlaygroundStore } from '../../store/playgroundStore'
import { useSettingsStore } from '../../store/settingsStore'
import EditorPanel from './EditorPanel'
import ExecutionPanel from './ExecutionPanel'

/**
 * After a short pause, scrolls the page so `element` sits at the top (minus its scroll-margin)
 * or, with `block: 'center'`, in the middle of the screen, easing out so it starts quickly and
 * settles gently. A centered element that is already fully on screen isn't scrolled to.
 * Returns a function that cancels it.
 */
function scrollToElement(element: HTMLElement, block: 'start' | 'center' = 'start'): () => void {
  let controls: ReturnType<typeof animate> | null = null

  const cancel = () => {
    clearTimeout(timer)
    controls?.stop()
    window.removeEventListener('wheel', cancel)
    window.removeEventListener('touchstart', cancel)
  }

  const timer = setTimeout(() => {
    // Measured now, after the Run result has rendered, so the target is where the element really is.
    const box = element.getBoundingClientRect()
    if (block === 'center' && box.top >= 0 && box.bottom <= window.innerHeight) return cancel()
    const offset =
      block === 'center'
        ? (window.innerHeight - box.height) / 2
        : parseFloat(getComputedStyle(element).scrollMarginTop) || 0
    const maxY = document.documentElement.scrollHeight - window.innerHeight
    const target = Math.max(0, Math.min(window.scrollY + box.top - offset, maxY))
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

type PanelId = 'editor' | 'execution'

function PlaygroundScreen() {
  const isPlaying = usePlaygroundStore((state) => state.isPlaying)
  const stepIndex = usePlaygroundStore((state) => state.stepIndex)
  const next = usePlaygroundStore((state) => state.next)
  const run = usePlaygroundStore((state) => state.run)
  const layoutRef = useRef<HTMLDivElement>(null)
  const executionRef = useRef<HTMLElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelScroll = useRef<(() => void) | null>(null)
  const reduceMotion = useReducedMotion()
  const splitRatio = useSettingsStore((state) => state.splitRatio)
  const setSplitRatio = useSettingsStore((state) => state.setSplitRatio)
  // The panel expanded to the full width, if any. Not saved: a reload shows both panels again.
  const [maximized, setMaximized] = useState<PanelId | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const { t } = useTranslation()

  // Auto Play: move one step forward after a short pause, until the store stops playing.
  useEffect(() => {
    if (!isPlaying) return
    const timer = setTimeout(next, AUTOPLAY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isPlaying, stepIndex, next])

  // Leaving the Playground stops a scroll that hasn't finished.
  useEffect(() => () => cancelScroll.current?.(), [])

  function handleRun() {
    // Rendered right away, so a collapsed Input field that a failed Run opens up is there to focus below.
    flushSync(run)
    cancelScroll.current?.()

    // scanf ran out of values: show the user the Input field, on any screen size, and put the cursor in it.
    const inputField = inputRef.current
    if (usePlaygroundStore.getState().inputMissing && inputField) {
      inputField.focus({ preventScroll: true })
      if (reduceMotion) inputField.scrollIntoView({ block: 'nearest' })
      else cancelScroll.current = scrollToElement(inputField, 'center')
      return
    }

    // On narrow screens the panels stack (flex-col below the min-[1000px] breakpoint), so the
    // Execution panel sits under the editor. Bring it into view so Run visibly does something.
    const layout = layoutRef.current
    const panel = executionRef.current
    // Skipped while the editor is expanded: the Execution panel is hidden then.
    if (maximized || !layout || !panel || getComputedStyle(layout).flexDirection !== 'column') return
    if (reduceMotion) panel.scrollIntoView({ block: 'start' })
    else cancelScroll.current = scrollToElement(panel)
  }

  function toggleMaximize(panel: PanelId) {
    setMaximized((current) => (current === panel ? null : panel))
  }

  // Dragging the divider: pointer capture keeps the moves coming even when the pointer leaves it.
  function handleDividerPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return
    event.preventDefault() // no text selection while dragging
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  function handleDividerPointerMove(event: PointerEvent<HTMLButtonElement>) {
    const layout = layoutRef.current
    if (!layout || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    const box = layout.getBoundingClientRect()
    const dividerWidth = event.currentTarget.offsetWidth
    // The divider's centre follows the pointer; the store keeps both panels at least SPLIT_MIN wide.
    setSplitRatio((event.clientX - box.left - dividerWidth / 2) / (box.width - dividerWidth))
  }

  function handleDividerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const targets: Record<string, number> = {
      ArrowLeft: splitRatio - SPLIT_KEY_STEP,
      ArrowRight: splitRatio + SPLIT_KEY_STEP,
      Home: SPLIT_MIN,
      End: SPLIT_MAX,
    }
    if (!(event.key in targets)) return
    event.preventDefault() // don't scroll the page
    setSplitRatio(Math.round(targets[event.key] * 100) / 100) // 0.45, not 0.44999999999999996
  }

  // Side by side (min-[1000px]), the editor takes --editor-share of the width left over by the
  // 20px (w-5) divider and the Execution panel (flex-1) takes the rest. Stacked, both are full width.
  const editorSplitClass =
    'min-[1000px]:flex-none min-[1000px]:basis-[calc((100%_-_20px)_*_var(--editor-share))]'

  return (
    <div
      ref={layoutRef}
      style={{ '--editor-share': splitRatio } as CSSProperties}
      className={`flex flex-col gap-5 min-[1000px]:flex-row min-[1000px]:gap-0 ${isDragging ? 'select-none' : ''}`}
    >
      <EditorPanel
        onRun={handleRun}
        inputRef={inputRef}
        isMaximized={maximized === 'editor'}
        onToggleMaximize={() => toggleMaximize('editor')}
        className={maximized === 'execution' ? 'hidden' : maximized === null ? editorSplitClass : ''}
      />

      {/* Only side by side, and only while both panels show. A real <button>, so it can take focus. */}
      {maximized === null && (
        <button
          type="button"
          aria-label={t('layout.resize')}
          title={t('layout.resize')}
          onPointerDown={handleDividerPointerDown}
          onPointerMove={handleDividerPointerMove}
          onLostPointerCapture={() => setIsDragging(false)}
          onKeyDown={handleDividerKeyDown}
          className="group hidden w-5 shrink-0 cursor-col-resize touch-none justify-center rounded-control focus-visible:outline-2 focus-visible:outline-accent min-[1000px]:flex"
        >
          {/* The grip stays in the middle of the screen while the page scrolls, within the divider. */}
          <span
            className={`sticky top-1/2 my-2 h-10 w-1 rounded-full transition-colors ${
              isDragging ? 'bg-accent' : 'bg-textMuted group-hover:bg-accent group-focus-visible:bg-accent'
            }`}
          />
        </button>
      )}

      <ExecutionPanel
        ref={executionRef}
        isMaximized={maximized === 'execution'}
        onToggleMaximize={() => toggleMaximize('execution')}
        className={maximized === 'editor' ? 'hidden' : ''}
      />
    </div>
  )
}

export default PlaygroundScreen
