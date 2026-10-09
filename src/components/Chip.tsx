import type { ReactNode } from 'react'

/** Small tinted label, e.g. the current function "main()" or an example's topic. */
function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-4.75 shrink-0 items-center rounded-control bg-accentTint px-2 font-mono text-label font-normal text-accentDark">
      {children}
    </span>
  )
}

export default Chip
