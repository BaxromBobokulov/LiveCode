import { motion, useReducedMotion } from 'framer-motion'
import Tooltip from './Tooltip'
import { GAME_HUB_URL } from '../constants/links'
import { useTranslation } from '../i18n/useTranslation'
import { track } from '../lib/analytics'

// A short wiggle of the icon every ~8s, so the button gets noticed without moving all the time.
// Only the icon inside the button moves (rotate/scale transforms), so nothing around it reflows.
const wiggleTransition = {
  duration: 0.6,
  times: [0, 0.15, 0.35, 0.55, 0.75, 1],
  ease: 'easeInOut' as const,
  delay: 3,
  repeat: Infinity,
  repeatDelay: 8,
}

/**
 * Icon link in the navbar to the LiveCode game hub. Larger than the settings buttons next to it and
 * tinted with the accent color, so it reads as a fun extra rather than another setting.
 * Opens in a new tab so the student's code in progress stays where it is.
 */
function GameLink() {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const label = t('nav.game')

  return (
    <Tooltip label={label}>
      <a
        href={GAME_HUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('game_link_clicked', {})}
        aria-label={`${label} ${t('link.newTab')}`}
        className="flex size-11 items-center justify-center rounded-control border border-accent bg-accentTint text-accentText transition-colors hover:bg-accent hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <motion.svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-5.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          animate={reduceMotion ? undefined : { rotate: [0, -14, 12, -8, 4, 0], scale: [1, 1.15, 1.15, 1.1, 1.05, 1] }}
          transition={wiggleTransition}
        >
          <path d="M6 5.5h8a4 4 0 0 1 3.9 3.1l.9 4.1a2.3 2.3 0 0 1-3.9 2.1L13 13h-6l-1.9 1.8a2.3 2.3 0 0 1-3.9-2.1l.9-4.1A4 4 0 0 1 6 5.5Z" />
          <path d="M6.5 8v3M5 9.5h3" />
          <circle cx="13" cy="9" r="0.4" fill="currentColor" />
          <circle cx="14.5" cy="10.5" r="0.4" fill="currentColor" />
        </motion.svg>
      </a>
    </Tooltip>
  )
}

export default GameLink
