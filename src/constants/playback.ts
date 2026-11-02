/** How long Auto Play waits on each step before moving to the next one. */
export const AUTOPLAY_DELAY_MS = 1000

/**
 * How long Run waits before scrolling, so the press registers first: to the Execution panel on
 * narrow screens, or to the scanf Input field when it is missing values.
 */
export const RUN_SCROLL_DELAY_MS = 120

/** How long that scroll takes, in seconds. */
export const RUN_SCROLL_DURATION_S = 0.55

/** How long the page takes to bring the current code line back on screen after a step, in seconds. */
export const LINE_SCROLL_DURATION_S = 0.25

/** How long the Execution panel's scrolling part takes to bring a step's change into view, in seconds. */
export const CHANGE_SCROLL_DURATION_S = 0.2
