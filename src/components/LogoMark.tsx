import { motion, useReducedMotion } from 'framer-motion'

// Right eye "<" open, and the same three points flattened into a line (closed).
// Both paths share one structure so Framer Motion can morph between them.
const eyeOpen = 'M20.5 12 14.5 16 20.5 20'
const eyeClosed = 'M20.5 16 14.5 16 20.5 16'

// One 4s cycle: open, quick close (~80ms), hold closed (~160ms), reopen (~80ms).
const winkTransition = {
  duration: 4,
  times: [0, 0.9, 0.92, 0.96, 0.98, 1],
  ease: 'easeInOut' as const,
  repeat: Infinity,
}

// Terminal-window face: window frame with three control dots, ">" "<" eyes and a mouth.
// The right eye winks every ~4s; it stays open when the user prefers reduced motion.
function LogoMark({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion()

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 36 36"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3.4" width="30" height="27.2" rx="4.2" />
      <g fill="currentColor" stroke="none">
        <circle cx="4.9" cy="6" r="0.8" />
        <circle cx="7.1" cy="6" r="0.8" />
        <circle cx="9.3" cy="6" r="0.8" />
      </g>
      {/* Face: larger and heavier than the frame so it reads clearly at 32px */}
      <g strokeWidth="2.5">
        <path d="M5 12 11 16 5 20" />
        {reduceMotion ? (
          <path d={eyeOpen} />
        ) : (
          <motion.path
            d={eyeOpen}
            animate={{ d: [eyeOpen, eyeOpen, eyeClosed, eyeClosed, eyeOpen, eyeOpen] }}
            transition={winkTransition}
          />
        )}
        <path d="M10.25 23.5h5" />
      </g>
    </svg>
  )
}

export default LogoMark
