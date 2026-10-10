import { motion, useReducedMotion } from 'framer-motion'

// Chap ko'zni 1-2px chapga suramiz (masalan: 6 -> 5, 11 -> 10)
const leftEyeOpen = 'M5 13 L10 16.5 L5 20'
const leftEyeClosed = 'M5 16.5 L10 16.5 L5 16.5'

// O'ng ko'zni 1-2px o'ngga suramiz (masalan: 19 -> 20, 14 -> 15)
const rightEyeOpen = 'M20 13 L15 16.5 L20 20'
const rightEyeClosed = 'M20 16.5 L15 16.5 L20 16.5'

// Ko'z yumilishi (blink) sikli
const blinkTransition = {
  duration: 4,
  times: [0, 0.42, 0.44, 0.46, 1],
  ease: 'easeInOut' as const,
  repeat: Infinity,
}

// Yuzning o'ngga va chapga qarashi
const lookTransition = {
  duration: 4,
  times: [0, 0.2, 0.36, 0.5, 0.65, 0.8, 1],
  ease: 'easeInOut' as const,
  repeat: Infinity,
}

// Butun korpusning yengil tebranishi
const bobTransition = {
  duration: 3,
  ease: 'easeInOut' as const,
  repeat: Infinity,
}

export default function TerminalLogo({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.svg
      aria-hidden="true"
      viewBox="0 0 36 36"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={reduceMotion ? undefined : { y: [0, -1, 0], rotate: [0, 1.2, 0] }}
      transition={bobTransition}
    >
      {/* Terminal ramkasi */}
      <rect x="2.5" y="2.5" width="32" height="32" rx="6.5" strokeWidth="2.8" />

      {/* Yuqori 3 ta nuqta */}
      <g fill="currentColor" stroke="none">
        <circle cx="6.5" cy="7.5" r="1.1" />
        <circle cx="9.8" cy="7.5" r="1.1" />
        <circle cx="13.1" cy="7.5" r="1.1" />
      </g>

      {/* Yuz (ko'zlar va og'iz birgalikda o'ngga/chapga buriladi) */}
      <motion.g
        strokeWidth="2.4"
        animate={reduceMotion ? undefined : { x: [0, 0, 3.5, 3.5, -1.8, -1.8, 0] }}
        transition={lookTransition}
      >
        {/* Chap ko'z ">" */}
        {reduceMotion ? (
          <path d={leftEyeOpen} />
        ) : (
          <motion.path
            d={leftEyeOpen}
            animate={{
              d: [leftEyeOpen, leftEyeOpen, leftEyeClosed, leftEyeOpen, leftEyeOpen],
            }}
            transition={blinkTransition}
          />
        )}

        {/* O'ng ko'z "<" */}
        {reduceMotion ? (
          <path d={rightEyeOpen} />
        ) : (
          <motion.path
            d={rightEyeOpen}
            animate={{
              d: [rightEyeOpen, rightEyeOpen, rightEyeClosed, rightEyeOpen, rightEyeOpen],
            }}
            transition={blinkTransition}
          />
        )}

        {/* Og'iz "_" */}
        <path d="M10.5 24.5 h6" />
      </motion.g>
    </motion.svg>
  )
}