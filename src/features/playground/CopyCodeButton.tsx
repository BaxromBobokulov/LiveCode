import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useTranslation } from '../../i18n/useTranslation'

type CopyState = 'idle' | 'copied' | 'failed'

/** How long the checkmark (or the "couldn't copy" mark) stays before the copy icon comes back. */
const FEEDBACK_MS = 1500

/**
 * Icon button in the editor header: copies the whole program to the clipboard.
 * For a moment afterwards the icon becomes a checkmark, or a "!" in the error color if the
 * browser refused (e.g. the page isn't on https, or clipboard access is blocked).
 */
function CopyCodeButton({ code }: { code: string }) {
  const { t } = useTranslation()
  const [state, setState] = useState<CopyState>('idle')
  const reduceMotion = useReducedMotion()

  // Go back to the copy icon after a moment.
  useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), FEEDBACK_MS)
    return () => clearTimeout(timer)
  }, [state])

  async function copy() {
    try {
      // navigator.clipboard is undefined outside a secure context, so this throws there too.
      await navigator.clipboard.writeText(code)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  const label = state === 'copied' ? t('editor.copied') : state === 'failed' ? t('editor.copyFailed') : t('editor.copy')

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={label}
      title={label}
      // Same look as MaximizeButton: 36px, with the before: layer stretching the touch target to 44px.
      className={`relative flex size-9 shrink-0 items-center justify-center rounded-control border border-borderStrong bg-panel transition-colors before:absolute before:-inset-1 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        state === 'copied' ? 'text-accentText' : state === 'failed' ? 'text-error' : 'text-textMuted hover:text-text'
      }`}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.svg
          key={state}
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.6 }}
          transition={{ duration: 0.18 }}
        >
          {state === 'copied' ? (
            // Checkmark
            <path d="M4.5 10.5l3.5 3.5 7.5-8" />
          ) : state === 'failed' ? (
            // Exclamation mark in a circle
            <>
              <circle cx="10" cy="10" r="6.5" />
              <path d="M10 6.5v4M10 13.5v.01" />
            </>
          ) : (
            // Two overlapping sheets: copy
            <>
              <rect x="7" y="7" width="9.5" height="9.5" rx="1.5" />
              <path d="M13 7V5a1.5 1.5 0 0 0-1.5-1.5h-6.5A1.5 1.5 0 0 0 3.5 5v6.5A1.5 1.5 0 0 0 5 13h2" />
            </>
          )}
        </motion.svg>
      </AnimatePresence>
      {/* Screen readers hear the result too, not only the new label */}
      <span role="status" className="sr-only">
        {state === 'idle' ? '' : label}
      </span>
    </button>
  )
}

export default CopyCodeButton
