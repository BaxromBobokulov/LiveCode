import { useEffect, useRef, useState, type ReactNode } from 'react'

/**
 * A small label under an icon-only button, shown after a short hover or on keyboard focus.
 * `label` should be the button's own aria-label, so the tooltip is hidden from screen readers
 * (they already hear it). Escape hides it until the pointer or focus leaves (WCAG 1.4.13).
 * Touch screens never show it: Tailwind's group-hover only applies where the device can hover.
 */
function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  const tipRef = useRef<HTMLSpanElement>(null)
  const [active, setActive] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // Lined up with the button's right edge, so the buttons at the right end of a panel header stay
  // inside it; flipped to the left edge when that would run past the panel's left side instead.
  const [align, setAlign] = useState<'end' | 'start'>('end')

  function show(wrapper: HTMLElement) {
    const tip = tipRef.current
    if (tip) {
      const panelLeft = wrapper.closest('section')?.getBoundingClientRect().left ?? 0
      setAlign(wrapper.getBoundingClientRect().right - tip.offsetWidth >= panelLeft ? 'end' : 'start')
    }
    setActive(true)
  }

  function hide() {
    setActive(false)
    setDismissed(false)
  }

  // Escape also works while only the pointer is over the button, so listen on the whole document.
  useEffect(() => {
    if (!active) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDismissed(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active])

  return (
    <span
      className="group relative inline-flex shrink-0"
      onPointerEnter={(event) => show(event.currentTarget)}
      onPointerLeave={hide}
      onFocus={(event) => show(event.currentTarget)}
      onBlur={hide}
    >
      {children}
      <span
        ref={tipRef}
        aria-hidden="true"
        // Inverted colors (text on panel, swapped) read as a tooltip in both themes at the same contrast
        // as body text. Appears after 500ms, disappears at once. z-300 sits above CodeMirror's gutter (200).
        className={`pointer-events-none absolute top-full z-300 mt-2 whitespace-nowrap rounded-control bg-text px-2 py-1 text-label font-normal text-panel opacity-0 shadow-xs transition-opacity duration-100 group-hover:opacity-100 group-hover:delay-500 group-has-focus-visible:opacity-100 group-has-focus-visible:delay-500 ${
          align === 'end' ? 'right-0' : 'left-0'
        } ${dismissed ? 'invisible' : ''}`}
      >
        {label}
      </span>
    </span>
  )
}

export default Tooltip
